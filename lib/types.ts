export type Stage =
  | "roster"
  | "teams_drawn"
  | "classification"
  | "pre_elim"
  | "final"
  | "finished";

export type RoomMode = "individual" | "equipos";
export type MatchStage = "classification" | "pre_elim" | "final";
export type MatchStatus = "pending" | "ready" | "done";

export interface Player {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  players: string[];
  eliminatedIn: MatchStage | null;
}

export interface Member {
  id: string;
  nickname: string;
  teamId: string | null;
  isOwner: boolean;
  joinedAt: number;
}

export interface LogEntry {
  ts: number;
  time: string;
  text: string;
  byMemberId?: string;
}

export interface Match {
  id: string;
  stage: MatchStage;
  order: number;
  round: number;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  leveA: number;
  leveB: number;
  status: MatchStatus;
  winnerId: string | null;
  restTeamId: string | null;
  log: LogEntry[];
}

export interface Room {
  code: string;
  name: string;
  mode: RoomMode;
  target: number;
  adminCode: string;
  playersA: Player[];
  playersB: Player[];
  teams: Team[];
  members: Member[];
  matches: Match[];
  activeMatchId: string | null;
  stage: Stage;
  champion: string | null;
  log: LogEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface Standing {
  team: Team;
  played: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
  isChampion: boolean;
  isOut: boolean;
  label: string;
}

export type ActionName =
  | "join"
  | "selectTeam"
  | "addPlayer"
  | "removePlayer"
  | "addTeam"
  | "removeTeam"
  | "drawTeams"
  | "redrawTeams"
  | "startTournament"
  | "addPoints"
  | "applyFault"
  | "declareWinner"
  | "reset";

export interface ActionPayload {
  nickname?: string;
  teamId?: string | null;
  tier?: "A" | "B";
  name?: string;
  playerId?: string;
  side?: "A" | "B";
  delta?: number;
  label?: string;
  level?: "leve" | "grave";
  matchId?: string;
  winnerId?: string;
  memberId?: string;
}

export interface SessionCtx {
  isAdmin: boolean;
  member?: Member;
}
