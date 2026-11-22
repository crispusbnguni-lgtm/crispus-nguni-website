export function canSkipAdditionalIdentityVerification(role: string): boolean {
  return role === "SUPER_ADMIN";
}
