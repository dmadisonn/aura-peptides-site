export interface FeatureFlags {
  emails: boolean;
  affiliates: boolean;
  aiImage: boolean;
  packingSlip: boolean;
  reconstitutionGuide: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  emails: true,
  affiliates: true,
  aiImage: false,
  packingSlip: true,
  reconstitutionGuide: true,
};
