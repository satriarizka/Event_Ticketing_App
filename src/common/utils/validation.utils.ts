// src/common/utils/validation.utils.ts
import { UUID_REGEX } from '../constants/regex.constant';

/**
 * Memvalidasi apakah sebuah string adalah UUID (v1-v5) yang valid.
 * @param uuid String yang akan divalidasi
 * @returns boolean
 */
export function isValidUUID(uuid: string): boolean {
    if (!uuid) return false;
    return UUID_REGEX.test(uuid);
}
