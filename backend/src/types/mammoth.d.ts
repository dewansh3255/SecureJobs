declare module 'mammoth' {
  interface RawTextResult {
    value: string;
    messages: unknown[];
  }
  interface ConvertOptions {
    buffer?: Buffer;
    path?: string;
  }
  function extractRawText(options: ConvertOptions): Promise<RawTextResult>;
  function convertToHtml(options: ConvertOptions): Promise<{ value: string; messages: unknown[] }>;
  export { extractRawText, convertToHtml };
  export default { extractRawText, convertToHtml };
}
