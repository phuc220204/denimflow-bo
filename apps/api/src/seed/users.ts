import type { SupabaseClient } from '@supabase/supabase-js';
import { type PrismaClient, Role } from '../generated/prisma/client.js';

interface DemoUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  stationCode?: string;
}

// One account per role (DATABASE_DESIGN.md §9). Emails use @denimflow.internal.
const DEMO_USERS: DemoUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@denimflow.internal',
    fullName: 'Quản Trị Viên Hệ Thống',
    role: Role.ADMIN,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'pe@denimflow.internal',
    fullName: 'Kỹ Sư Quy Trình May',
    role: Role.PROCESS_ENGINEER,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'planner@denimflow.internal',
    fullName: 'Điều Độ Kế Hoạch Sản Xuất',
    role: Role.PRODUCTION_PLANNER,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'warehouse@denimflow.internal',
    fullName: 'Thủ Kho Vải & Phụ Liệu',
    role: Role.WAREHOUSE_KEEPER,
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'operator@denimflow.internal',
    fullName: 'Tổ Trưởng Chuyền Cắt',
    role: Role.STATION_OPERATOR,
    stationCode: 'CUT-01',
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'qc@denimflow.internal',
    fullName: 'Kiểm Định Chất Lượng KCS',
    role: Role.QC_INSPECTOR,
    stationCode: 'QC-01',
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    email: 'manager@denimflow.internal',
    fullName: 'Giám Đốc Quản Lý Xưởng',
    role: Role.MANAGER,
  },
];

// Returns the Supabase Auth user id for the email, creating the user or resetting its password
// so the seed always leaves the demo accounts on SEED_DEFAULT_PASSWORD.
async function ensureAuthUser(
  supabase: SupabaseClient,
  user: DemoUser,
  password: string,
  existingIds: Map<string, string>,
): Promise<string> {
  const existingId = existingIds.get(user.email);
  if (existingId) {
    const { error } = await supabase.auth.admin.updateUserById(existingId, { password });
    if (error) throw new Error(`Could not reset the password of ${user.email}: ${error.message}`);
    return existingId;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Could not create ${user.email}: ${error?.message ?? 'no user returned'}`);
  }
  return data.user.id;
}

// Without Supabase only the profiles are written (enough for local tests); with Supabase the
// Auth accounts are created or updated first so profile ids match auth.users ids.
export async function seedUsers(
  prisma: PrismaClient,
  supabase: SupabaseClient | null,
  password: string,
): Promise<void> {
  const existingIds = new Map<string, string>();
  if (supabase) {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(`Could not list Auth users: ${error.message}`);
    for (const u of data.users) {
      if (u.email) existingIds.set(u.email, u.id);
    }
  }

  for (const user of DEMO_USERS) {
    const id = supabase ? await ensureAuthUser(supabase, user, password, existingIds) : user.id;
    const station = user.stationCode
      ? await prisma.station.findUniqueOrThrow({ where: { code: user.stationCode } })
      : null;

    await prisma.profile.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        stationId: station?.id ?? null,
        isActive: true,
      },
      create: {
        id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        stationId: station?.id ?? null,
        isActive: true,
      },
    });
  }

  console.log(
    supabase
      ? `Seeded ${DEMO_USERS.length} demo accounts (password from SEED_DEFAULT_PASSWORD).`
      : `Seeded ${DEMO_USERS.length} demo profiles (Supabase not configured: no Auth accounts).`,
  );
}
