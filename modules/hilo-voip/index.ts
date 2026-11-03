import { requireOptionalNativeModule, type NativeModule } from 'expo';

type Events = { onToken: (event: { token: string }) => void };

declare class HiloVoipModule extends NativeModule<Events> {
  getToken(): string | null;
}

/** Null on web, Android and the simulator builds without it */
export default requireOptionalNativeModule<HiloVoipModule>('HiloVoip');
