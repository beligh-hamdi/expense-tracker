/**
 * M3 system color tokens available as category colors.
 * Resolved at runtime via getComputedStyle so they match the active theme.
 */
export const MAT_COLOR_TOKENS: { token: string; label: string }[] = [
  { token: '--mat-sys-primary',                label: 'Primary'             },
  { token: '--mat-sys-secondary',              label: 'Secondary'           },
  { token: '--mat-sys-tertiary',               label: 'Tertiary'            },
  { token: '--mat-sys-error',                  label: 'Error'               },
  { token: '--mat-sys-primary-container',      label: 'Primary container'   },
  { token: '--mat-sys-secondary-container',    label: 'Secondary container' },
  { token: '--mat-sys-tertiary-container',     label: 'Tertiary container'  },
  { token: '--mat-sys-error-container',        label: 'Error container'     },
  { token: '--mat-sys-on-primary-container',   label: 'On primary cont.'    },
  { token: '--mat-sys-on-secondary-container', label: 'On secondary cont.'  },
  { token: '--mat-sys-on-tertiary-container',  label: 'On tertiary cont.'   },
  { token: '--mat-sys-on-error-container',     label: 'On error cont.'      },
  { token: '--mat-sys-surface-tint',           label: 'Surface tint'        },
  { token: '--mat-sys-outline',                label: 'Outline'             },
  { token: '--mat-sys-outline-variant',        label: 'Outline variant'     },
  { token: '--mat-sys-inverse-primary',        label: 'Inverse primary'     },
  { token: '--mat-sys-shadow',                 label: 'Shadow'              },
  { token: '--mat-sys-scrim',                  label: 'Scrim'               },
  { token: '--mat-sys-neutral10',              label: 'Neutral'             },
  { token: '--mat-sys-neutral-variant20',      label: 'Neutral variant'     },
];

/** Resolve a --mat-sys-* CSS custom property to its computed value.
 *  M3 tokens are declared on <html> via mat.theme(), so we read from
 *  documentElement — body does not inherit custom properties in this context.
 */
export function resolveMatToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}
