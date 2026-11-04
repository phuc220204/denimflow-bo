import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { APP_CONFIG, type AppConfig } from '../../config/env.schema.js';
@Injectable()
export class EvidenceStorage {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  private bucket() {
    if (!this.config.SUPABASE_URL || !this.config.SUPABASE_SERVICE_ROLE_KEY)
      throw new ServiceUnavailableException('Chưa cấu hình Supabase Storage');
    return createClient(this.config.SUPABASE_URL, this.config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).storage.from(this.config.SUPABASE_STORAGE_BUCKET ?? 'denimflow-files');
  }
  async sign(path: string) {
    const { data, error } = await this.bucket().createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw new ServiceUnavailableException('Không thể tạo đường dẫn tải lên');
    return data;
  }
  async info(path: string) {
    const { data, error } = await this.bucket().info(path);
    if (error || !data) throw new BadRequestException('File chưa được tải lên Storage');
    return { mimeType: data.contentType ?? '', sizeBytes: data.size ?? 0 };
  }
  async signedRead(path: string) {
    const { data, error } = await this.bucket().createSignedUrl(path, 300);
    if (error || !data) throw new ServiceUnavailableException('Không thể mở file');
    return data.signedUrl;
  }
}
