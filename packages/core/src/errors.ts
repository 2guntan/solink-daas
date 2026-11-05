/** Erreur métier avec code stable (v4 §14.1 : { error: { code, message } }). */
export class BusinessError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 409,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export const isBusinessError = (e: unknown): e is BusinessError =>
  e instanceof Error && (e as BusinessError).name === 'BusinessError';
