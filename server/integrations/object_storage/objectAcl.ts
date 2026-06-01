export type ObjectAclPolicy = "public" | "private";
export type ObjectAccessGroup = string;
export type ObjectAccessGroupType = string;
export interface ObjectAclRule { group: ObjectAccessGroup; policy: ObjectAclPolicy; }

export function canAccessObject(_key: string, _userId?: string): boolean { return true; }
export async function getObjectAclPolicy(_bucketName: string): Promise<ObjectAclPolicy> { return "private"; }
export async function setObjectAclPolicy(_bucketName: string, _policy: ObjectAclPolicy): Promise<void> {}
