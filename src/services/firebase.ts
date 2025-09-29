import { getApp } from '@react-native-firebase/app';

export type FirebaseInfo = {
  appName: string;
  appId?: string;
  projectId?: string;
};

const pickString = (
  o: Record<string, unknown>,
  key: string,
): string | undefined => {
  const v = o[key];
  return typeof v === 'string' ? v : undefined;
};

export const getFirebaseInfoSafe = (): FirebaseInfo | null => {
  try {
    const app = getApp(); // lanza si no existe la app por defecto
    const raw = (app.options ?? {}) as Record<string, unknown>;

    const info: FirebaseInfo = { appName: app.name };

    // Solo asignamos si existe (evita undefined con exactOptionalPropertyTypes)
    const appId = pickString(raw, 'appId') ?? pickString(raw, 'applicationId');
    if (appId) info.appId = appId;

    const projectId = pickString(raw, 'projectId');
    if (projectId) info.projectId = projectId;

    return info;
  } catch {
    return null; // Firebase no inicializado aún
  }
};
