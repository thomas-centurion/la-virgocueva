export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type NotificationType = 'follow' | 'like' | 'repost' | 'comment' | 'reply';

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; username: string; display_name: string; bio: string; avatar_path: string | null; cover_path: string | null; created_at: string; updated_at: string },
        { id: string; username: string; display_name?: string; bio?: string; avatar_path?: string | null; cover_path?: string | null },
        { username?: string; display_name?: string; bio?: string; avatar_path?: string | null; cover_path?: string | null }
      >;
      posts: Table<
        { id: string; user_id: string; body: string; image_path: string | null; created_at: string; updated_at: string },
        { id?: string; user_id: string; body: string; image_path?: string | null },
        { body?: string; image_path?: string | null }
      >;
      comments: Table<
        { id: string; post_id: string; user_id: string; parent_comment_id: string | null; body: string; image_path: string | null; created_at: string; updated_at: string },
        { id?: string; post_id: string; user_id: string; parent_comment_id?: string | null; body: string; image_path?: string | null },
        { parent_comment_id?: string | null; body?: string; image_path?: string | null }
      >;
      likes: Table<
        { post_id: string; user_id: string; created_at: string },
        { post_id: string; user_id: string },
        never
      >;
      reposts: Table<
        { post_id: string; user_id: string; created_at: string },
        { post_id: string; user_id: string },
        never
      >;
      follows: Table<
        { follower_id: string; following_id: string; created_at: string; updated_at: string },
        { follower_id: string; following_id: string; created_at?: string; updated_at?: string },
        { updated_at?: string }
      >;
      notifications: Table<
        { id: string; recipient_id: string; actor_id: string; type: NotificationType; post_id: string | null; comment_id: string | null; created_at: string; read_at: string | null },
        never,
        { read_at?: string | null }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
