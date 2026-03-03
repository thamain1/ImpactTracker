import { z } from 'zod';
import {
  insertOrganizationSchema,
  updateOrganizationSchema,
  insertProgramSchema,
  insertServiceAreaSchema,
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
        role: z.enum(["admin", "can_edit", "can_view", "can_view_download"]),
      }),
      responses: {
        201: z.custom<typeof userRoles.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/organizations/:orgId/roles/:id' as const,
      input: z.object({
        role: z.enum(["admin", "can_edit", "can_view", "can_view_download"]),
      }),
      responses: {
        200: z.custom<typeof userRoles.$inferSelect>(),
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
        metrics: z.array(z.object({
          name: z.string(),
          unit: z.string(),
          countsAsParticipant: z.boolean().optional().default(true),
          itemType: z.string().optional().default("service"),
          unitCost: z.number().optional().nullable(),
          inventoryTotal: z.number().int().optional().nullable(),
          allocationType: z.string().optional().default("fixed"),
          allocationBaseQty: z.number().int().optional().default(1),
          allocationThreshold: z.number().int().optional().nullable(),
          allocationBonusQty: z.number().int().optional().nullable(),
          customQuestionPrompt: z.string().optional().nullable(),
        })),
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
  metrics: {
    create: {
      method: 'POST' as const,
      path: '/api/programs/:programId/metrics' as const,
      input: z.object({
        name: z.string().min(1),
        unit: z.string().min(1),
        countsAsParticipant: z.boolean().optional().default(true),
        itemType: z.string().optional().default("service"),
        unitCost: z.number().optional().nullable(),
        inventoryTotal: z.number().int().optional().nullable(),
        allocationType: z.string().optional().default("fixed"),
        allocationBaseQty: z.number().int().optional().default(1),
        allocationThreshold: z.number().int().optional().nullable(),
        allocationBonusQty: z.number().int().optional().nullable(),
        customQuestionPrompt: z.string().optional().nullable(),
      }),
      responses: {
        201: z.custom<typeof impactMetrics.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/programs/:programId/metrics/:id' as const,
      input: z.object({
        countsAsParticipant: z.boolean().optional(),
        itemType: z.string().optional(),
        unitCost: z.number().optional().nullable(),
        inventoryTotal: z.number().int().optional().nullable(),
        inventoryRemaining: z.number().int().optional().nullable(),
        allocationType: z.string().optional(),
        allocationBaseQty: z.number().int().optional(),
        allocationThreshold: z.number().int().optional().nullable(),
        allocationBonusQty: z.number().int().optional().nullable(),
        customQuestionPrompt: z.string().optional().nullable(),
      }),
      responses: {
        200: z.custom<typeof impactMetrics.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/programs/:programId/metrics/:id' as const,
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
    update: {
      method: 'PUT' as const,
      path: '/api/impact/:id' as const,
      input: insertImpactEntrySchema.partial(),
      responses: {
        200: z.custom<typeof impactEntries.$inferSelect>(),
        404: errorSchemas.notFound,
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
  census: {
    comparison: {
      method: 'GET' as const,
      path: '/api/census/comparison' as const,
      responses: {
        200: z.array(z.object({
          geographyLevel: z.string(),
          geographyValue: z.string(),
          impactCount: z.number(),
          totalPopulation: z.number().nullable(),
          povertyRate: z.number().nullable(),
          medianIncome: z.number().nullable(),
          reachPercent: z.number().nullable(),
          isApproximate: z.boolean(),
          approximateNote: z.string().optional(),
          dataYear: z.number(),
        })),
      },
    },
    lookup: {
      method: 'GET' as const,
      path: '/api/census' as const,
      input: z.object({
        level: z.enum(["SPA", "City", "County", "State"]),
        value: z.string(),
      }),
      responses: {
        200: z.object({
          geographyLevel: z.string(),
          geographyValue: z.string(),
          totalPopulation: z.number().nullable(),
          povertyRate: z.number().nullable(),
          medianIncome: z.number().nullable(),
          isApproximate: z.boolean(),
          approximateNote: z.string().optional(),
          dataYear: z.number(),
        }),
      },
    },
    batch: {
      method: 'POST' as const,
      path: '/api/census/batch' as const,
      input: z.object({
        geographies: z.array(z.object({
          level: z.string(),
          value: z.string(),
        })),
      }),
      responses: {
        200: z.array(z.object({
          geographyLevel: z.string(),
          geographyValue: z.string(),
          totalPopulation: z.number().nullable(),
          povertyRate: z.number().nullable(),
          medianIncome: z.number().nullable(),
          isApproximate: z.boolean(),
          approximateNote: z.string().optional(),
          dataYear: z.number(),
        })),
      },
    },
    ageGroups: {
      method: 'POST' as const,
      path: '/api/census/age-groups' as const,
      input: z.object({
        geographies: z.array(z.object({
          level: z.string(),
          value: z.string(),
        })),
        ageMin: z.number().min(0).optional(),
        ageMax: z.number().max(120).optional(),
      }),
      responses: {
        200: z.array(z.object({
          geographyLevel: z.string(),
          geographyValue: z.string(),
          totalPopulation: z.number().nullable(),
          targetAgePopulation: z.number().nullable(),
          ageGroups: z.array(z.object({
            label: z.string(),
            minAge: z.number(),
            maxAge: z.number(),
            population: z.number(),
          })),
          isApproximate: z.boolean(),
          dataYear: z.number(),
        })),
      },
    },
  },
  dashboard: {
    charts: {
      method: 'GET' as const,
      path: '/api/dashboard/charts' as const,
      responses: {
        200: z.object({
          participantsByMonth: z.array(z.object({
            month: z.string(),
            count: z.number(),
          })),
          participantsByProgram: z.array(z.object({
            programId: z.number(),
            programName: z.string(),
            count: z.number(),
          })),
          resourcesByProgram: z.array(z.object({
            programId: z.number(),
            programName: z.string(),
            metrics: z.record(z.string(), z.number()),
          })),
          goalVsActual: z.array(z.object({
            programId: z.number(),
            programName: z.string(),
            targetPopulation: z.string().nullable(),
            goals: z.string().nullable(),
            goalTarget: z.number().nullable(),
            actual: z.number(),
          })),
        }),
      },
    },
  },
  serviceAreas: {
    list: {
      method: 'GET' as const,
      path: '/api/organizations/:orgId/service-areas' as const,
      responses: {
        200: z.array(z.object({
          id: z.number(),
          orgId: z.number(),
          name: z.string(),
          lat: z.number(),
          lng: z.number(),
          description: z.string().nullable(),
          createdAt: z.any(),
        })),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/organizations/:orgId/service-areas' as const,
      input: insertServiceAreaSchema,
      responses: {
        201: z.object({
          id: z.number(),
          orgId: z.number(),
          name: z.string(),
          lat: z.number(),
          lng: z.number(),
          description: z.string().nullable(),
          createdAt: z.any(),
        }),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/organizations/:orgId/service-areas/:id' as const,
      input: insertServiceAreaSchema.partial(),
      responses: {
        200: z.object({
          id: z.number(),
          orgId: z.number(),
          name: z.string(),
          lat: z.number(),
          lng: z.number(),
          description: z.string().nullable(),
          createdAt: z.any(),
        }),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/organizations/:orgId/service-areas/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  programBuilder: {
    chat: {
      method: "POST" as const,
      path: "/api/program-builder/chat" as const,
      input: z.object({
        messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
        orgId: z.number(),
      }),
      responses: {
        200: z.unknown(),
        400: errorSchemas.validation,
        403: errorSchemas.unauthorized,
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
