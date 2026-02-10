import { z } from 'zod';
import { 
  insertOrganizationSchema,
  updateOrganizationSchema,
  insertProgramSchema,
  updateProgramSchema,
  insertImpactEntrySchema,
  insertUserRoleSchema,
  organizations,
  programs,
  impactMetrics,
  impactEntries,
  userRoles,
  users
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  organizations: {
    list: {
      method: 'GET' as const,
      path: '/api/organizations' as const,
      responses: {
        200: z.array(z.custom<typeof organizations.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/organizations' as const,
      input: insertOrganizationSchema,
      responses: {
        201: z.custom<typeof organizations.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/organizations/:id' as const,
      responses: {
        200: z.custom<typeof organizations.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/organizations/:id' as const,
      input: updateOrganizationSchema,
      responses: {
        200: z.custom<typeof organizations.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  userRoles: {
    list: {
      method: 'GET' as const,
      path: '/api/organizations/:orgId/roles' as const,
      responses: {
        200: z.array(z.object({
          id: z.number(),
          userId: z.string(),
          orgId: z.number(),
          role: z.string(),
          createdAt: z.any(),
          user: z.object({
            id: z.string(),
            email: z.string().nullable(),
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
          }).nullable(),
        })),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/organizations/:orgId/roles' as const,
      input: z.object({
        email: z.string().email(),
        role: z.enum(["admin", "staff"]),
      }),
      responses: {
        201: z.custom<typeof userRoles.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/organizations/:orgId/roles/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  programs: {
    list: {
      method: 'GET' as const,
      path: '/api/programs' as const,
      input: z.object({ orgId: z.coerce.number().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof programs.$inferSelect & { metrics: typeof impactMetrics.$inferSelect[] }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/programs' as const,
      input: insertProgramSchema.extend({
        metrics: z.array(z.object({ name: z.string(), unit: z.string() })),
      }),
      responses: {
        201: z.custom<typeof programs.$inferSelect & { metrics: typeof impactMetrics.$inferSelect[] }>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/programs/:id' as const,
      responses: {
        200: z.custom<typeof programs.$inferSelect & { metrics: typeof impactMetrics.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/programs/:id' as const,
      input: updateProgramSchema,
      responses: {
        200: z.custom<typeof programs.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/programs/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  impact: {
    list: {
      method: 'GET' as const,
      path: '/api/impact' as const,
      input: z.object({ 
        programId: z.coerce.number(),
        geographyLevel: z.string().optional(),
      }),
      responses: {
        200: z.array(z.custom<typeof impactEntries.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/impact' as const,
      input: insertImpactEntrySchema,
      responses: {
        201: z.custom<typeof impactEntries.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/impact/stats' as const,
      input: z.object({ programId: z.coerce.number() }),
      responses: {
        200: z.array(z.object({
          geographyLevel: z.string(),
          geographyValue: z.string(),
          metrics: z.record(z.string(), z.number())
        })),
      },
    },
    exportCsv: {
      method: 'GET' as const,
      path: '/api/impact/export' as const,
      input: z.object({ programId: z.coerce.number() }),
      responses: {
        200: z.string(),
      },
    },
  },
  admin: {
    stats: {
      method: 'GET' as const,
      path: '/api/admin/stats' as const,
      responses: {
        200: z.object({
          totalOrganizations: z.number(),
          totalPrograms: z.number(),
          totalEntries: z.number(),
          byGeography: z.array(z.object({
            geographyLevel: z.string(),
            count: z.number(),
            totalMetrics: z.record(z.string(), z.number()),
          })),
          recentPrograms: z.array(z.custom<typeof programs.$inferSelect>()),
        }),
      },
    },
  },
};

// ============================================
// HELPER
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type OrganizationResponse = z.infer<typeof api.organizations.get.responses[200]>;
export type ProgramResponse = z.infer<typeof api.programs.get.responses[200]>;
export type ImpactStatsResponse = z.infer<typeof api.impact.stats.responses[200]>;
