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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      cash_sessions: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          id: string
          opened_at: string
          opening_balance: number
          staff_id: string
          store_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          id?: string
          opened_at?: string
          opening_balance: number
          staff_id: string
          store_id: string
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          id?: string
          opened_at?: string
          opening_balance?: number
          staff_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cash_sessions_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          id: string
          order_id: string
          pod_data: Json | null
          rider_id: string | null
          status: string
          store_id: string | null
          tracking_token: string
        }
        Insert: {
          id?: string
          order_id: string
          pod_data?: Json | null
          rider_id?: string | null
          status?: string
          store_id?: string | null
          tracking_token: string
        }
        Update: {
          id?: string
          order_id?: string
          pod_data?: Json | null
          rider_id?: string | null
          status?: string
          store_id?: string | null
          tracking_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          ai_extracted_data: Json | null
          amount: number
          created_at: string
          id: string
          receipt_url: string | null
          store_id: string
        }
        Insert: {
          ai_extracted_data?: Json | null
          amount: number
          created_at?: string
          id?: string
          receipt_url?: string | null
          store_id: string
        }
        Update: {
          ai_extracted_data?: Json | null
          amount?: number
          created_at?: string
          id?: string
          receipt_url?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_expenses_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          loyalty_points: number
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          loyalty_points?: number
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          loyalty_points?: number
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_members_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category: string
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          store_id: string
        }
        Insert: {
          category: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price: number
          store_id: string
        }
        Update: {
          category?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_menu_items_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_edit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          edited_by: string | null
          id: string
          order_id: string
          reason: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          edited_by?: string | null
          id?: string
          order_id: string
          reason: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          edited_by?: string | null
          id?: string
          order_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_edit_logs_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_edit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          container_charge: number | null
          container_size:
            | Database["public"]["Enums"]["container_size_enum"]
            | null
          fulfillment_type:
            | Database["public"]["Enums"]["fulfillment_type_enum"]
            | null
          id: string
          menu_item_id: string
          notes: string | null
          order_id: string
          price_at_order: number
          quantity: number
        }
        Insert: {
          container_charge?: number | null
          container_size?:
            | Database["public"]["Enums"]["container_size_enum"]
            | null
          fulfillment_type?:
            | Database["public"]["Enums"]["fulfillment_type_enum"]
            | null
          id?: string
          menu_item_id: string
          notes?: string | null
          order_id: string
          price_at_order: number
          quantity?: number
        }
        Update: {
          container_charge?: number | null
          container_size?:
            | Database["public"]["Enums"]["container_size_enum"]
            | null
          fulfillment_type?:
            | Database["public"]["Enums"]["fulfillment_type_enum"]
            | null
          id?: string
          menu_item_id?: string
          notes?: string | null
          order_id?: string
          price_at_order?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string | null
          delivery_service:
            | Database["public"]["Enums"]["delivery_service_enum"]
            | null
          id: string
          member_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          table_id: string | null
          total_amount: number
          type: Database["public"]["Enums"]["order_type"]
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          delivery_service?:
            | Database["public"]["Enums"]["delivery_service_enum"]
            | null
          id?: string
          member_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          table_id?: string | null
          total_amount?: number
          type: Database["public"]["Enums"]["order_type"]
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          delivery_service?:
            | Database["public"]["Enums"]["delivery_service_enum"]
            | null
          id?: string
          member_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          table_id?: string | null
          total_amount?: number
          type?: Database["public"]["Enums"]["order_type"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          order_id: string
          paid_by: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          order_id: string
          paid_by?: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"]
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          order_id?: string
          paid_by?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_settings: {
        Row: {
          auto_print: boolean | null
          badge_colors: Json | null
          created_at: string | null
          id: string
          print_on_status: string[] | null
          printer_name: string | null
          sound_choice: string | null
          sound_file_url: string | null
          store_id: string
        }
        Insert: {
          auto_print?: boolean | null
          badge_colors?: Json | null
          created_at?: string | null
          id?: string
          print_on_status?: string[] | null
          printer_name?: string | null
          sound_choice?: string | null
          sound_file_url?: string | null
          store_id: string
        }
        Update: {
          auto_print?: boolean | null
          badge_colors?: Json | null
          created_at?: string | null
          id?: string
          print_on_status?: string[] | null
          printer_name?: string | null
          sound_choice?: string | null
          sound_file_url?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          id: string
          status: Database["public"]["Enums"]["rider_status"]
          store_id: string
          user_id: string
        }
        Insert: {
          id?: string
          status?: Database["public"]["Enums"]["rider_status"]
          store_id: string
          user_id: string
        }
        Update: {
          id?: string
          status?: Database["public"]["Enums"]["rider_status"]
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_riders_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          phone_number: string | null
          phone_number_2: string | null
          settings: Json | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          phone_number?: string | null
          phone_number_2?: string | null
          settings?: Json | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          phone_number?: string | null
          phone_number_2?: string | null
          settings?: Json | null
        }
        Relationships: []
      }
      tables: {
        Row: {
          created_at: string
          id: string
          qr_token: string
          status: string
          store_id: string
          table_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          qr_token: string
          status?: string
          store_id: string
          table_number: string
        }
        Update: {
          created_at?: string
          id?: string
          qr_token?: string
          status?: string
          store_id?: string
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tables_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          store_id: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_store"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth_member_id: { Args: never; Returns: string }
      get_auth_rider_id: { Args: never; Returns: string }
      get_auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_auth_store_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "staff" | "member" | "rider" | "admin"
      container_size_enum: "small" | "large"
      delivery_service_enum: "jnj" | "grabfood" | "shopeefood" | "custom"
      fulfillment_type_enum: "dine_in" | "takeaway"
      kyc_status: "pending" | "verified" | "rejected"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "completed"
        | "cancelled"
      order_type: "dine_in" | "online" | "delivery" | "takeaway"
      payment_method_enum: "cash" | "card" | "qr" | "bank_transfer"
      rider_status: "available" | "busy" | "offline"
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
      app_role: ["staff", "member", "rider", "admin"],
      container_size_enum: ["small", "large"],
      delivery_service_enum: ["jnj", "grabfood", "shopeefood", "custom"],
      fulfillment_type_enum: ["dine_in", "takeaway"],
      kyc_status: ["pending", "verified", "rejected"],
      order_status: ["pending", "preparing", "ready", "completed", "cancelled"],
      order_type: ["dine_in", "online", "delivery", "takeaway"],
      payment_method_enum: ["cash", "card", "qr", "bank_transfer"],
      rider_status: ["available", "busy", "offline"],
    },
  },
} as const
