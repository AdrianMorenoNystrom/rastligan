import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, editorRequest, loadMatches } from "../lib/api";
import type { PlayerId } from "../lib/domain";
interface Session {
  player_id: PlayerId;
  expires_at: string;
  absolute_expires_at: string;
  token?: string;
}
interface Auth {
  session: Session | null;
  checking: boolean;
  error: string;
  login: (id: PlayerId, code: string) => Promise<void>;
  logout: () => Promise<void>;
  request: <T>(body: Record<string, unknown>) => Promise<T>;
  refresh: () => void;
}
const AuthContext = createContext<Auth | null>(null);
const tokenKey = "rastligan.editor.v1";
const storedToken = () => {
  try {
    return localStorage.getItem(tokenKey);
  } catch {
    return null;
  }
};
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(storedToken);
  const client = useQueryClient();
  const forget = useCallback(() => {
    try {
      localStorage.removeItem(tokenKey);
    } catch {
      /* Memory-only session remains supported. */
    }
    setToken(null);
  }, []);
  const query = useQuery({
    queryKey: ["editor-session", token],
    enabled: Boolean(token),
    queryFn: async () => {
      try {
        return await editorRequest<Session>({ action: "session" }, token);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          forget();
          return null;
        }
        throw e;
      }
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: "always",
    retry: false,
    gcTime: 0,
  });
  const session = token ? query.data || null : null;
  const checking = Boolean(token) && query.isPending;
  const error = query.isError
    ? "Kunde inte kontrollera redigerarsessionen. Försök igen när anslutningen är tillbaka."
    : "";
  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key === tokenKey) setToken(e.newValue);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const login = async (id: PlayerId, code: string) => {
    const data = await editorRequest<Session & { token: string }>({
      action: "login",
      player_id: id,
      code,
    });
    try {
      localStorage.setItem(tokenKey, data.token);
    } catch {
      /* Session works until reload. */
    }
    client.setQueryData(["editor-session", data.token], data);
    setToken(data.token);
  };
  const logout = async () => {
    await editorRequest({ action: "logout" }, token);
    forget();
    client.removeQueries({ queryKey: ["editor-session"] });
  };
  const request = async <T,>(body: Record<string, unknown>): Promise<T> => {
    try {
      return await editorRequest<T>(body, token);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) forget();
      throw e;
    }
  };
  return (
    <AuthContext.Provider
      value={{
        session,
        checking,
        error,
        login,
        logout,
        request,
        refresh: () => {
          void query.refetch();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext)!;
export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: loadMatches,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
export function useRefreshMatches() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["matches"] });
}
