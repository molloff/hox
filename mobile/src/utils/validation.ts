const BG_PHONE_REGEX = /^[89]\d{8}$/;

export function isValidBgPhone(digits: string): boolean {
  return BG_PHONE_REGEX.test(digits);
}

export function formatPhoneDisplay(phone: string): string {
  // +359887123456 → +359 887 123 456
  if (phone.startsWith('+359') && phone.length === 13) {
    return `+359 ${phone.slice(4, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
  }
  return phone;
}

export function maskPhone(phone: string): string {
  // +359887123456 → +359 *** *** 456
  if (phone.length >= 13) {
    return `+359 *** *** ${phone.slice(-3)}`;
  }
  return phone;
}
