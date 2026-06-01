export interface FeatureFlags {
  emails: boolean;
  affiliates: boolean;
  aiImage: boolean;
  packingSlip: boolean;
  reconstitutionGuide: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  emails: false,
  affiliates: true,
  aiImage: false,
  packingSlip: false,
  reconstitutionGuide: false,
};

export function useFeatureFlags(): FeatureFlags {
  return DEFAULT_FLAGS;
}
