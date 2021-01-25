export interface ILogging {
  /* eslint-disable @typescript-eslint/no-explicit-any*/
  info(message: string, ...parameters: any[]): void;
  warn(message: string, ...parameters: any[]): void;
  error(message: string, ...parameters: any[]): void;
  debug(message: string, ...parameters: any[]): void;
  /* eslint-enable @typescript-eslint/no-explicit-any*/
}