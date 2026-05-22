import { randomUUID } from "node:crypto";
import type { PreviewConfig, PreviewConnectionSource } from "./types.js";

export type PreviewConnection = Pick<PreviewConfig, "targetUrl" | "token" | "userUuid">;
export type PreviewSession = {
  id: string;
  csrfToken: string;
  connection: PreviewConnection;
  source: PreviewConnectionSource;
};

export class PreviewSessionStore {
  private readonly sessions = new Map<string, Omit<PreviewSession, "id"> & { expiresAt: number }>();
  private readonly ttlMs = 12 * 60 * 60 * 1000;
  private readonly maxSessions = 100;

  constructor(private readonly defaults: PreviewConnection & { connectionSource: PreviewConnectionSource }) {}

  create(input: Partial<PreviewConnection> = {}): PreviewSession {
    this.prune();
    const id = randomUUID();
    const csrfToken = randomUUID();
    const connection = this.normalize(input);
    const source = hasConnectionInput(input) ? "saved" : this.defaults.connectionSource;
    this.sessions.set(id, { csrfToken, connection, source, expiresAt: Date.now() + this.ttlMs });
    this.prune();
    return { id, csrfToken, connection, source };
  }

  get(id: string | undefined): PreviewSession | undefined {
    if (!id) {
      return undefined;
    }
    const session = this.sessions.get(id);
    if (!session) {
      return undefined;
    }
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    session.expiresAt = Date.now() + this.ttlMs;
    return {
      id,
      csrfToken: session.csrfToken,
      connection: session.connection,
      source: session.source,
    };
  }

  getOrCreate(id: string | undefined): PreviewSession {
    return this.get(id) ?? this.create();
  }

  update(id: string | undefined, input: Partial<PreviewConnection>): PreviewSession {
    const current = this.getOrCreate(id);
    const connection = this.normalize({ ...current.connection, ...input });
    const source = hasConnectionInput(input) ? "saved" : current.source;
    this.sessions.set(current.id, {
      csrfToken: current.csrfToken,
      connection,
      source,
      expiresAt: Date.now() + this.ttlMs,
    });
    this.prune();
    return { id: current.id, csrfToken: current.csrfToken, connection, source };
  }

  private normalize(input: Partial<PreviewConnection>): PreviewConnection {
    return {
      targetUrl: input.targetUrl?.trim() || this.defaults.targetUrl,
      token: input.token?.trim() || this.defaults.token,
      userUuid: input.userUuid?.trim() || this.defaults.userUuid,
    };
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id);
      }
    }

    while (this.sessions.size > this.maxSessions) {
      const oldest = this.sessions.keys().next().value;
      if (!oldest) return;
      this.sessions.delete(oldest);
    }
  }
}

function hasConnectionInput(input: Partial<PreviewConnection>): boolean {
  return Boolean(input.targetUrl?.trim() || input.token?.trim() || input.userUuid?.trim());
}
