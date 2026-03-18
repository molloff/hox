import { DefaultApi, Configuration, Region } from '@onfido/api';
import { env } from './env.js';

const configuration = new Configuration({
  apiToken: env.ONFIDO_API_TOKEN,
  region: Region.EU,
});

export const onfido = new DefaultApi(configuration);
