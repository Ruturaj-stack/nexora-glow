export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          model: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          model?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          model?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_credentials: {
        Row: {
          ciphertext: string
          created_at: string
          device_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          device_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          device_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_credentials_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_events: {
        Row: {
          created_at: string
          device_id: string | null
          device_name: string
          id: string
          level: string
          message: string
          payload: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          device_name?: string
          id?: string
          level?: string
          message?: string
          payload?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          device_name?: string
          id?: string
          level?: string
          message?: string
          payload?: Json
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_history: {
        Row: {
          action: string
          created_at: string
          detail: string
          device_id: string | null
          device_name: string
          duration_ms: number
          id: string
          source: string
          status: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string
          device_id?: string | null
          device_name?: string
          duration_ms?: number
          id?: string
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string
          device_id?: string | null
          device_name?: string
          duration_ms?: number
          id?: string
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_history_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_pairings: {
        Row: {
          code: string
          connector: string
          created_at: string
          device_id: string | null
          expires_at: string
          id: string
          method: string
          name: string
          payload: Json
          status: string
          type: string
          user_id: string
        }
        Insert: {
          code: string
          connector?: string
          created_at?: string
          device_id?: string | null
          expires_at?: string
          id?: string
          method?: string
          name?: string
          payload?: Json
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          code?: string
          connector?: string
          created_at?: string
          device_id?: string | null
          expires_at?: string
          id?: string
          method?: string
          name?: string
          payload?: Json
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_pairings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          address: string
          battery: number | null
          capabilities: string[]
          charging: boolean
          connection: string
          connector: string
          created_at: string
          device_group: string
          favorite: boolean
          firmware: string
          id: string
          last_seen_at: string | null
          metadata: Json
          name: string
          paired_at: string
          platform: string
          revoked: boolean
          signal: number | null
          state: Json
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string
          battery?: number | null
          capabilities?: string[]
          charging?: boolean
          connection?: string
          connector?: string
          created_at?: string
          device_group?: string
          favorite?: boolean
          firmware?: string
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          name: string
          paired_at?: string
          platform?: string
          revoked?: boolean
          signal?: number | null
          state?: Json
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          battery?: number | null
          capabilities?: string[]
          charging?: boolean
          connection?: string
          connector?: string
          created_at?: string
          device_group?: string
          favorite?: boolean
          firmware?: string
          id?: string
          last_seen_at?: string | null
          metadata?: Json
          name?: string
          paired_at?: string
          platform?: string
          revoked?: boolean
          signal?: number | null
          state?: Json
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          importance: number
          pinned: boolean
          source: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          importance?: number
          pinned?: boolean
          source?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          importance?: number
          pinned?: boolean
          source?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          error: boolean
          id: string
          role: string
          token_count: number
          user_id: string
        }
        Insert: {
          attachments?: Json
          content?: string
          conversation_id: string
          created_at?: string
          error?: boolean
          id?: string
          role: string
          token_count?: number
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          error?: boolean
          id?: string
          role?: string
          token_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      plugins: {
        Row: {
          enabled: boolean
          id: string
          installed_at: string
          manifest: Json
          name: string
          permissions: string[]
          plugin_id: string
          settings: Json
          source: string
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          installed_at?: string
          manifest?: Json
          name?: string
          permissions?: string[]
          plugin_id: string
          settings?: Json
          source?: string
          updated_at?: string
          user_id: string
          version?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          installed_at?: string
          manifest?: Json
          name?: string
          permissions?: string[]
          plugin_id?: string
          settings?: Json
          source?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email?: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tool_executions: {
        Row: {
          category: string
          created_at: string
          duration_ms: number
          error: string | null
          error_code: string | null
          id: string
          params: Json
          permission: string
          result: Json | null
          runtime: string
          source: string
          status: string
          tool: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          duration_ms?: number
          error?: string | null
          error_code?: string | null
          id?: string
          params?: Json
          permission?: string
          result?: Json | null
          runtime?: string
          source?: string
          status?: string
          tool: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          duration_ms?: number
          error?: string | null
          error_code?: string | null
          id?: string
          params?: Json
          permission?: string
          result?: Json | null
          runtime?: string
          source?: string
          status?: string
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
      tool_permissions: {
        Row: {
          created_at: string
          decision: string
          id: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision?: string
          id?: string
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          accent_color: string
          created_at: string
          id: string
          language: string
          notifications: boolean
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          id?: string
          language?: string
          notifications?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          id?: string
          language?: string
          notifications?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          created_at: string
          duration_ms: number
          error: string | null
          finished_at: string | null
          id: string
          logs: Json
          started_at: string
          status: string
          steps: Json
          trigger: string
          user_id: string
          variables: Json
          workflow_id: string | null
          workflow_name: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json
          started_at?: string
          status?: string
          steps?: Json
          trigger?: string
          user_id: string
          variables?: Json
          workflow_id?: string | null
          workflow_name?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json
          started_at?: string
          status?: string
          steps?: Json
          trigger?: string
          user_id?: string
          variables?: Json
          workflow_id?: string | null
          workflow_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_triggers: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          last_fired_at: string | null
          next_run_at: string | null
          type: string
          updated_at: string
          user_id: string
          workflow_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_fired_at?: string | null
          next_run_at?: string | null
          type?: string
          updated_at?: string
          user_id: string
          workflow_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          last_fired_at?: string | null
          next_run_at?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_triggers_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          category: string
          created_at: string
          description: string
          enabled: boolean
          failures: number
          graph: Json
          id: string
          last_run_at: string | null
          last_status: string
          name: string
          runs: number
          template_id: string
          updated_at: string
          user_id: string
          variables: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          failures?: number
          graph?: Json
          id?: string
          last_run_at?: string | null
          last_status?: string
          name: string
          runs?: number
          template_id?: string
          updated_at?: string
          user_id: string
          variables?: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          failures?: number
          graph?: Json
          id?: string
          last_run_at?: string | null
          last_status?: string
          name?: string
          runs?: number
          template_id?: string
          updated_at?: string
          user_id?: string
          variables?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
