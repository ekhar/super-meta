export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          database_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          last_used_at: string | null
          name: string
          owner_id: string
          permissions: Json
          slug: string
        }
        Insert: {
          created_at?: string
          database_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          last_used_at?: string | null
          name: string
          owner_id: string
          permissions?: Json
          slug: string
        }
        Update: {
          created_at?: string
          database_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          permissions?: Json
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
        ]
      }
      databases: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
          storage_size_bytes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          storage_size_bytes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          storage_size_bytes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      new_api_keys_audit: {
        Row: {
          created_at: string
          database_id: string | null
          id: string
          read_key: string | null
          viewed_at: string | null
          write_key: string | null
        }
        Insert: {
          created_at: string
          database_id?: string | null
          id?: string
          read_key?: string | null
          viewed_at?: string | null
          write_key?: string | null
        }
        Update: {
          created_at?: string
          database_id?: string | null
          id?: string
          read_key?: string | null
          viewed_at?: string | null
          write_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "new_api_keys_audit_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_metrics: {
        Row: {
          last_updated_at: string | null
          total_api_requests: number | null
          total_egress_bytes: number | null
          total_read_bytes: number | null
          total_write_bytes: number | null
          user_id: string
        }
        Insert: {
          last_updated_at?: string | null
          total_api_requests?: number | null
          total_egress_bytes?: number | null
          total_read_bytes?: number | null
          total_write_bytes?: number | null
          user_id: string
        }
        Update: {
          last_updated_at?: string | null
          total_api_requests?: number | null
          total_egress_bytes?: number | null
          total_read_bytes?: number | null
          total_write_bytes?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_metrics_daily: {
        Row: {
          api_requests: number | null
          created_at: string | null
          date: string
          egress_bytes: number | null
          id: string
          read_bytes: number | null
          user_id: string | null
          write_bytes: number | null
        }
        Insert: {
          api_requests?: number | null
          created_at?: string | null
          date: string
          egress_bytes?: number | null
          id?: string
          read_bytes?: number | null
          user_id?: string | null
          write_bytes?: number | null
        }
        Update: {
          api_requests?: number | null
          created_at?: string | null
          date?: string
          egress_bytes?: number | null
          id?: string
          read_bytes?: number | null
          user_id?: string | null
          write_bytes?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_api_key: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_unique_slug: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_api_keys: {
        Args: { p_database_id: string }
        Returns: {
          read_key: string
          write_key: string
          read_slug: string
          write_slug: string
        }[]
      }
      get_user_metrics: {
        Args: { p_user_id: string; p_start_date: string; p_end_date: string }
        Returns: {
          date: string
          api_requests: number
          read_bytes: number
          write_bytes: number
          egress_bytes: number
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_for_policy: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      record_api_metrics: {
        Args: {
          p_user_id: string
          p_read_bytes?: number
          p_write_bytes?: number
          p_egress_bytes?: number
        }
        Returns: undefined
      }
      verify_api_key: {
        Args: { api_key: string; required_permission?: string }
        Returns: {
          database_id: string
        }[]
      }
    }
    Enums: {
      user_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: ["admin", "user"],
    },
  },
} as const

