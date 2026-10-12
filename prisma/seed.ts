import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
const ADMIN_FULLNAME = process.env.ADMIN_FULLNAME ?? 'System Administrator';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@karrali.local';

// =============================================================
// Permission catalog — the full set of actions in the system.
// Add to this list as new modules come online. The seed is
// idempotent, so re-running is safe.
// =============================================================
const PERMISSIONS: { Code: string; Description: string }[] = [
    // --- Auth / users / audit ---
    { Code: 'users.view', Description: 'View users' },
    { Code: 'users.create', Description: 'Create users' },
    { Code: 'users.update', Description: 'Update users' },
    { Code: 'users.delete', Description: 'Delete users' },
    { Code: 'roles.view', Description: 'View roles and permissions' },
    { Code: 'roles.manage', Description: 'Create/update/delete roles and assign permissions' },
    { Code: 'audit.view', Description: 'View audit logs' },

    // --- Master data ---
    { Code: 'products.view', Description: 'View products' },
    { Code: 'products.create', Description: 'Create products' },
    { Code: 'products.update', Description: 'Update products' },
    { Code: 'products.delete', Description: 'Delete products' },
    { Code: 'categories.manage', Description: 'Manage categories' },
    { Code: 'brands.manage', Description: 'Manage brands' },
    { Code: 'warehouses.manage', Description: 'Manage warehouses' },
    { Code: 'terminals.manage', Description: 'Manage terminals' },

    { Code: 'customers.view', Description: 'View customers' },
    { Code: 'customers.create', Description: 'Create customers' },
    { Code: 'customers.update', Description: 'Update customers' },
    { Code: 'customers.delete', Description: 'Delete customers' },

    { Code: 'suppliers.view', Description: 'View suppliers' },
    { Code: 'suppliers.manage', Description: 'Manage suppliers' },

    // --- Purchases ---
    { Code: 'purchases.view', Description: 'View purchases' },
    { Code: 'purchases.create', Description: 'Create purchases' },
    { Code: 'purchases.update', Description: 'Update purchases' },
    { Code: 'purchases.delete', Description: 'Delete purchases' },
    { Code: 'supplier_payments.view', Description: 'View supplier payments' },
    { Code: 'supplier_payments.create', Description: 'Create supplier payments' },
    { Code: 'supplier_payments.clear', Description: 'Clear/bounce supplier cheques' },
    { Code: 'supplier_cheques.view', Description: 'View supplier cheques' },
    { Code: 'supplier_cheques.create', Description: 'Issue supplier cheques' },
    { Code: 'supplier_cheques.clear', Description: 'Mark supplier cheques as cleared' },
    { Code: 'supplier_cheques.bounce', Description: 'Mark supplier cheques as bounced' },
    { Code: 'supplier_cheques.void', Description: 'Void a pending supplier cheque' },
    { Code: 'supplier_payments.reverse', Description: 'Reverse (delete) a recorded supplier payment' },

    // --- Sales ---
    { Code: 'sales.view', Description: 'View sales' },
    { Code: 'sales.create', Description: 'Create sales / checkout' },
    { Code: 'sales.update', Description: 'Update sales' },
    { Code: 'sales.void', Description: 'Void / cancel sales' },
    { Code: 'sales.discount', Description: 'Apply invoice discounts' },

    { Code: 'sale_returns.view', Description: 'View sale returns' },
    { Code: 'sale_returns.create', Description: 'Create sale returns' },
    { Code: 'sale_returns.approve', Description: 'Approve sale returns' },

    { Code: 'credit_payments.view', Description: 'View credit payments' },
    { Code: 'credit_payments.create', Description: 'Create credit payments' },
    { Code: 'credit_payments.clear', Description: 'Clear/bounce customer cheques' },

    { Code: 'quotations.view', Description: 'View quotations' },
    { Code: 'quotations.create', Description: 'Create quotations' },
    { Code: 'quotations.update', Description: 'Update quotations' },
    { Code: 'quotations.convert', Description: 'Convert quotations into sales' },

    // --- Cash ---
    { Code: 'cash_sessions.view', Description: 'View cash sessions' },
    { Code: 'cash_sessions.open', Description: 'Open a cash session' },
    { Code: 'cash_sessions.close', Description: 'Close a cash session' },
    { Code: 'cash_ledger.view', Description: 'View cash ledger' },
    { Code: 'cash_in_out.create', Description: 'Record manual cash in / out' },

    // --- Expenses ---
    { Code: 'expenses.view', Description: 'View expenses' },
    { Code: 'expenses.create', Description: 'Create expenses' },
    { Code: 'expenses.update', Description: 'Update expenses' },
    { Code: 'expenses.delete', Description: 'Delete expenses' },

    // --- Reports ---
    { Code: 'reports.sales', Description: 'Sales reports' },
    { Code: 'reports.profit', Description: 'Profit / COGS reports' },
    { Code: 'reports.stock', Description: 'Stock valuation reports' },
    { Code: 'reports.aging', Description: 'AR aging reports' },
    { Code: 'reports.z_report', Description: 'Z-report / day close' },
    { Code: 'reports.cheque_calendar', Description: 'Cheque calendar' },

    // --- Settings ---
    { Code: 'settings.view', Description: 'View settings' },
    { Code: 'settings.manage', Description: 'Manage settings' },

    //warehouses and terminals
    { Code: 'warehouses.view', Description: 'View warehouses' },
    { Code: 'terminals.view', Description: 'View terminals' },
];

// =============================================================
// System roles -> permissions.
// '*' = every permission in the catalog.
// =============================================================
const ROLES: { Name: string; Description: string; Permissions: '*' | string[] }[] = [
    {
        Name: 'ADMIN',
        Description: 'Full system access. Cannot be deleted.',
        Permissions: '*',
    },
    {
        Name: 'MANAGER',
        Description: 'Store manager — everything except user/role administration.',
        Permissions: [
            'products.view', 'products.create', 'products.update', 'products.delete',
            'categories.manage', 'brands.manage', 'warehouses.manage', 'terminals.manage',
            'customers.view', 'customers.create', 'customers.update', 'customers.delete',
            'suppliers.view', 'suppliers.manage',
            'purchases.view', 'purchases.create', 'purchases.update', 'purchases.delete',
            'supplier_payments.view', 'supplier_payments.create', 'supplier_payments.clear',
            'sales.view', 'sales.create', 'sales.update', 'sales.void', 'sales.discount',
            'sale_returns.view', 'sale_returns.create', 'sale_returns.approve',
            'credit_payments.view', 'credit_payments.create', 'credit_payments.clear',
            'quotations.view', 'quotations.create', 'quotations.update', 'quotations.convert',
            'cash_sessions.view', 'cash_sessions.open', 'cash_sessions.close',
            'cash_ledger.view', 'cash_in_out.create',
            'expenses.view', 'expenses.create', 'expenses.update',
            'reports.sales', 'reports.profit', 'reports.stock', 'reports.aging',
            'reports.z_report', 'reports.cheque_calendar',
            'audit.view',
        ],
    },
    {
        Name: 'CASHIER',
        Description: 'Front-desk cashier — sales, customers, drawer.',
        Permissions: [
            'products.view',
            'customers.view', 'customers.create', 'customers.update',
            'sales.view', 'sales.create', 'sales.discount',
            'sale_returns.view', 'sale_returns.create',
            'credit_payments.view', 'credit_payments.create',
            'quotations.view', 'quotations.create',
            'cash_sessions.view', 'cash_sessions.open', 'cash_sessions.close',
            'reports.z_report',
        ],
    },
    {
        Name: 'ACCOUNTANT',
        Description: 'Finance — payments, ledgers, reports.',
        Permissions: [
            'products.view', 'customers.view', 'suppliers.view',
            'purchases.view', 'supplier_payments.view', 'supplier_payments.clear',
            'sales.view', 'sale_returns.view',
            'credit_payments.view', 'credit_payments.clear',
            'cash_sessions.view', 'cash_ledger.view',
            'expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete',
            'reports.sales', 'reports.profit', 'reports.stock', 'reports.aging',
            'reports.cheque_calendar',
            'audit.view',
        ],
    },
    {
        Name: 'VIEWER',
        Description: 'Read-only access across the system.',
        Permissions: [
            'products.view', 'customers.view', 'suppliers.view',
            'purchases.view', 'sales.view', 'sale_returns.view',
            'credit_payments.view', 'cash_sessions.view', 'cash_ledger.view',
            'expenses.view', 'quotations.view',
            'reports.sales', 'reports.stock', 'reports.aging',
        ],
    },
];

// =============================================================
// Seeder functions
// =============================================================
async function seedPermissions() {
    console.log('  ↳ Upserting %d permissions...', PERMISSIONS.length);
    for (const p of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { Code: p.Code },
            create: { Code: p.Code, Description: p.Description },
            update: { Description: p.Description },
        });
    }
}

async function seedRoles() {
    console.log('  ↳ Upserting %d roles...', ROLES.length);
    for (const r of ROLES) {
        const role = await prisma.role.upsert({
            where: { Name: r.Name },
            create: { Name: r.Name, Description: r.Description, IsSystem: true },
            update: { Description: r.Description, IsSystem: true },
        });

        const codes = r.Permissions === '*'
            ? PERMISSIONS.map(p => p.Code)
            : r.Permissions;

        const perms = await prisma.permission.findMany({
            where: { Code: { in: codes } },
            select: { Id: true, Code: true },
        });

        if (perms.length !== codes.length) {
            const found = new Set(perms.map(p => p.Code));
            const missing = codes.filter(c => !found.has(c));
            throw new Error(`Role ${r.Name}: unknown permission codes -> ${missing.join(', ')}`);
        }

        for (const p of perms) {
            await prisma.rolePermission.upsert({
                where: { RoleId_PermissionId: { RoleId: role.Id, PermissionId: p.Id } },
                create: { RoleId: role.Id, PermissionId: p.Id },
                update: {},
            });
        }
    }
}

async function seedAdmin() {
    console.log('  ↳ Upserting admin user "%s"...', ADMIN_USERNAME);

    const existing = await prisma.user.findUnique({ where: { Username: ADMIN_USERNAME } });

    let adminId: string;
    if (existing) {
        adminId = existing.Id;
        console.log('    (admin already exists — not touching password)');
    } else {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
        const created = await prisma.user.create({
            data: {
                Username: ADMIN_USERNAME,
                PasswordHash: passwordHash,
                FullName: ADMIN_FULLNAME,
                Email: ADMIN_EMAIL,
                IsActive: true,
            },
        });
        adminId = created.Id;
    }

    const adminRole = await prisma.role.findUnique({ where: { Name: 'ADMIN' } });
    if (!adminRole) throw new Error('ADMIN role missing — cannot assign to admin user');

    await prisma.userRole.upsert({
        where: { UserId_RoleId: { UserId: adminId, RoleId: adminRole.Id } },
        create: { UserId: adminId, RoleId: adminRole.Id },
        update: {},
    });
}

async function seedWarehouseAndTerminal() {
    console.log('  ↳ Upserting default warehouse and terminal...');

    const warehouse = await prisma.warehouse.upsert({
        where: { Code: 'MAIN' },
        create: {
            Name: 'Main Warehouse',
            Code: 'MAIN',
            IsActive: true,
            IsDefault: true,
        },
        update: { IsActive: true },
    });

    await prisma.terminal.upsert({
        where: { Code: 'MAIN-01' },
        create: {
            Name: 'Main Terminal',
            Code: 'MAIN-01',
            WarehouseId: warehouse.Id,
            IsActive: true,
        },
        update: { IsActive: true, WarehouseId: warehouse.Id },
    });
}

async function main() {
    console.log('🌱 Seeding Karrali POS database...');
    await seedPermissions();
    await seedRoles();
    await seedAdmin();
    await seedWarehouseAndTerminal();
    console.log('✅ Seed complete.');

    if (ADMIN_PASSWORD === 'Admin@12345') {
        console.log('');
        console.log('⚠️  WARNING: Using default admin password. Change it before production.');
        console.log('   Login: %s / %s', ADMIN_USERNAME, ADMIN_PASSWORD);
        console.log('');
    }
}

main()
    .catch((err) => {
        console.error('❌ Seed failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });