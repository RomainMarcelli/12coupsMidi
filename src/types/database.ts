/**
 * Types générés à partir du schéma Supabase.
 *
 * Pour régénérer depuis la source (recommandé dès qu'on modifie une migration) :
 *
 *   npx supabase gen types typescript --project-id <ton-project-id> --schema public > src/types/database.ts
 *
 * ou en local si la CLI supabase est initialisée :
 *
 *   npx supabase gen types typescript --local > src/types/database.ts
 *
 * Ce fichier est un PLACEHOLDER tapé à la main d'après supabase/migrations/0001_init.sql.
 * Il sera remplacé par une génération automatique dès que le user aura configuré
 * la CLI Supabase.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type QuestionType =
  | "quizz_2"
  | "quizz_4"
  | "etoile"
  | "face_a_face"
  | "coup_maitre"
  | "coup_par_coup";

/** Sous-format optionnel pour quizz_2 (Coup d'Envoi). */
export type QuestionFormat = "vrai_faux" | "ou" | "plus_moins";

export type UserRole = "user" | "admin";

export type GameMode =
  | "jeu1"
  | "coup_par_coup"
  | "etoile"
  | "face_a_face"
  | "coup_maitre"
  | "parcours"
  | "revision"
  | "douze_coups";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          pseudo: string;
          role: UserRole;
          xp: number;
          niveau: number;
          created_at: string;
          avatar_url: string | null;
          theme: "light" | "dark" | "system";
          settings: Json;
        };
        Insert: {
          id: string;
          pseudo: string;
          role?: UserRole;
          xp?: number;
          niveau?: number;
          created_at?: string;
          avatar_url?: string | null;
          theme?: "light" | "dark" | "system";
          settings?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      user_favorites: {
        Row: {
          user_id: string;
          question_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          question_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_favorites"]["Insert"]>;
        Relationships: [];
      };
      saved_players: {
        Row: {
          id: string;
          owner_id: string;
          pseudo: string;
          avatar_url: string | null;
          games_played: number;
          games_won: number;
          last_played_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          pseudo: string;
          avatar_url?: string | null;
          games_played?: number;
          games_won?: number;
          last_played_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_players"]["Insert"]>;
        Relationships: [];
      };
      tv_rooms: {
        Row: {
          id: string;
          code: string;
          host_id: string;
          status: "waiting" | "playing" | "paused" | "ended";
          game_mode: string;
          state: Json;
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          host_id: string;
          status?: "waiting" | "playing" | "paused" | "ended";
          game_mode: string;
          state?: Json;
          created_at?: string;
          ended_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tv_rooms"]["Insert"]>;
        Relationships: [];
      };
      tv_room_players: {
        Row: {
          id: string;
          room_id: string;
          player_token: string;
          pseudo: string;
          avatar_url: string | null;
          position: number | null;
          is_connected: boolean;
          last_seen_at: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_token: string;
          pseudo: string;
          avatar_url?: string | null;
          position?: number | null;
          is_connected?: boolean;
          last_seen_at?: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tv_room_players"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: number;
          nom: string;
          slug: string;
          emoji: string | null;
          couleur: string | null;
        };
        Insert: {
          id?: number;
          nom: string;
          slug: string;
          emoji?: string | null;
          couleur?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      subcategories: {
        Row: {
          id: number;
          category_id: number | null;
          nom: string;
          slug: string;
        };
        Insert: {
          id?: number;
          category_id?: number | null;
          nom: string;
          slug: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["subcategories"]["Insert"]
        >;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          type: QuestionType;
          category_id: number | null;
          subcategory_id: number | null;
          difficulte: number;
          enonce: string;
          reponses: Json;
          bonne_reponse: string | null;
          alias: Json | null;
          indices: Json | null;
          image_url: string | null;
          explication: string | null;
          author_id: string | null;
          created_at: string;
          format: QuestionFormat | null;
        };
        Insert: {
          id?: string;
          type: QuestionType;
          category_id?: number | null;
          subcategory_id?: number | null;
          difficulte?: number;
          enonce: string;
          reponses: Json;
          bonne_reponse?: string | null;
          alias?: Json | null;
          indices?: Json | null;
          image_url?: string | null;
          explication?: string | null;
          author_id?: string | null;
          created_at?: string;
          format?: QuestionFormat | null;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
        Relationships: [];
      };
      game_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          mode: GameMode;
          score: number;
          correct_count: number;
          total_count: number;
          duration_seconds: number | null;
          xp_gained: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          mode: GameMode;
          score?: number;
          correct_count?: number;
          total_count?: number;
          duration_seconds?: number | null;
          xp_gained?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["game_sessions"]["Insert"]
        >;
        Relationships: [];
      };
      answers_log: {
        Row: {
          id: number;
          session_id: string | null;
          user_id: string | null;
          question_id: string | null;
          is_correct: boolean;
          time_taken_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id?: string | null;
          user_id?: string | null;
          question_id?: string | null;
          is_correct: boolean;
          time_taken_ms?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["answers_log"]["Insert"]>;
        Relationships: [];
      };
      wrong_answers: {
        Row: {
          id: number;
          user_id: string | null;
          question_id: string | null;
          fail_count: number;
          success_streak: number;
          last_seen_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          question_id?: string | null;
          fail_count?: number;
          success_streak?: number;
          last_seen_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["wrong_answers"]["Insert"]
        >;
        Relationships: [];
      };
      badges: {
        Row: {
          id: number;
          code: string;
          nom: string;
          description: string | null;
          icone: string | null;
        };
        Insert: {
          id?: number;
          code: string;
          nom: string;
          description?: string | null;
          icone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["badges"]["Insert"]>;
        Relationships: [];
      };
      user_badges: {
        Row: {
          user_id: string;
          badge_id: number;
          obtained_at: string;
        };
        Insert: {
          user_id: string;
          badge_id: number;
          obtained_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_badges"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
