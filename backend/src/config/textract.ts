import { TextractClient } from '@aws-sdk/client-textract';
import { env } from './env.js';

export const textract = new TextractClient({
  region: env.AWS_REGION,
});
