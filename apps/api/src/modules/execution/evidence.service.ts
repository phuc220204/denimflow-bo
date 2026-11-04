import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AttachEvidenceDto, EvidenceUploadDto } from '@denimflow/shared';
import type { AuthResponse } from '../auth/auth.service.js';
import { ExecutionRepository } from './execution.repository.js';
import { assertMayWork } from './step-access.js';
import { EvidenceStorage } from './evidence-storage.js';
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
@Injectable()
export class EvidenceService {
  constructor(
    @Inject(ExecutionRepository) private readonly repository: ExecutionRepository,
    @Inject(EvidenceStorage) private readonly storage: EvidenceStorage,
  ) {}
  private async step(
    tx: Parameters<ExecutionRepository['findStepForTransition']>[0],
    id: string,
    user: AuthResponse['user'],
  ) {
    await this.repository.lockSteps(tx, [id]);
    const step = await this.repository.findStepForTransition(tx, id);
    if (!step) throw new NotFoundException('Không tìm thấy bước sản xuất');
    await assertMayWork(this.repository, tx, step.stepDefinition, user);
    if (step.status !== 'IN_PROGRESS')
      throw new ConflictException('Chỉ đính kèm bằng chứng khi đang làm');
    return step;
  }
  async sign(id: string, input: EvidenceUploadDto, user: AuthResponse['user']) {
    return this.repository.runInTransaction(async (tx) => {
      const step = await this.step(tx, id, user);
      const path = `orders/${step.instance.order.id}/evidence/${id}/${user.id}/${randomUUID()}.${extensions[input.mimeType]}`;
      const signed = await this.storage.sign(path);
      return { filePath: path, signedUrl: signed.signedUrl };
    });
  }
  async attach(id: string, input: AttachEvidenceDto, user: AuthResponse['user']) {
    return this.repository.runInTransaction(async (tx) => {
      const step = await this.step(tx, id, user);
      const prefix = `orders/${step.instance.order.id}/evidence/${id}/${user.id}/`;
      const tail = input.filePath.slice(prefix.length);
      if (!input.filePath.startsWith(prefix) || !/^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(tail))
        throw new BadRequestException('File không thuộc bước và người tải lên này');
      if ((await this.repository.findEvidence(id, tx)).some((e) => e.filePath === input.filePath))
        throw new ConflictException('File đã được đính kèm');
      const info = await this.storage.info(input.filePath);
      if (!extensions[info.mimeType] || info.sizeBytes <= 0 || info.sizeBytes > 5 * 1024 * 1024)
        throw new BadRequestException('Chỉ nhận ảnh/PDF, tối đa 5 MB');
      const evidence = await this.repository.createEvidence(tx, {
        stepInstanceId: id,
        filePath: input.filePath,
        ...info,
        note: input.note ?? null,
        uploadedBy: user.id,
      });
      await this.repository.recordAudit(tx, {
        entityType: 'Evidence',
        entityId: evidence.id,
        action: 'ATTACH_EVIDENCE',
        actorId: user.id,
        newValue: { stepInstanceId: id, filePath: evidence.filePath },
      });
      return { ...evidence, uploadedAt: evidence.uploadedAt.toISOString() };
    });
  }
  async list(id: string) {
    return (await this.repository.findEvidence(id)).map((e) => ({
      ...e,
      uploadedAt: e.uploadedAt.toISOString(),
    }));
  }
  async read(id: string, evidenceId: string) {
    const file = (await this.repository.findEvidence(id)).find((e) => e.id === evidenceId);
    if (!file) throw new NotFoundException('Không tìm thấy bằng chứng');
    return { signedUrl: await this.storage.signedRead(file.filePath) };
  }
}
