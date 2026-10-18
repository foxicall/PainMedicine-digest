export interface ProtocolSource {
  id: string;
  title: string;
  url: string;
  location: string;
  kind: 'Trial report' | 'Trial protocol' | 'Trial follow-up' | 'Regulatory review';
}

export interface TreatmentArm {
  label: string;
  role:
    'Intervention' | 'Active comparator' | 'Control' | 'Shared treatment' | 'Diagnostic selection';
  kind: 'Drug' | 'Injection' | 'Procedure' | 'Behavioral / physical' | 'Usual care';
  agentOrProcedure: string;
  route?: string;
  dose?: string | null;
  preparation?: string | null;
  schedule: string;
  titration?: string | null;
  technique?: string | null;
  parameters?: string | null;
  coInterventions?: string;
  sourceIds: string[];
}

export interface TreatmentProtocol {
  summary: string;
  design: string;
  checkedOn: string;
  arms: TreatmentArm[];
  sources: ProtocolSource[];
  gaps: string[];
}

export const protocolFields = [
  ['agentOrProcedure', 'Drug / procedure'],
  ['route', 'Route / anatomical target'],
  ['dose', 'Dose'],
  ['preparation', 'Concentration / volume'],
  ['schedule', 'Frequency / duration'],
  ['titration', 'Loading / titration / taper'],
  ['technique', 'Procedure / guidance'],
  ['parameters', 'Device / lesion parameters'],
  ['coInterventions', 'Co-interventions'],
] as const;

export function protocolText(protocol?: TreatmentProtocol) {
  if (!protocol) return 'Not extracted; consult the original study.';
  return protocol.arms
    .map(
      (arm) =>
        `${arm.label} (${arm.role}): ${protocolFields
          .filter(([key]) => arm[key] !== undefined)
          .map(([key, label]) => `${label}: ${arm[key] ?? 'Not extracted'}`)
          .join('; ')}`,
    )
    .join('\n');
}
