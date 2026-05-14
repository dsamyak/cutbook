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
      attendance: {
        Row: {
          barber_id: string
          check_in: string | null
          check_out: string | null
          date: string
          id: string
          status: string
        }
        Insert: {
          barber_id: string
          check_in?: string | null
          check_out?: string | null
          date: string
          id?: string
          status?: string
        }
        Update: {
          barber_id?: string
          check_in?: string | null
          check_out?: string | null
          date?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          mobile: string | null
          monthly_salary: number
          pin: string | null
          shift_start: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id?: string
          mobile?: string | null
          monthly_salary?: number
          pin?: string | null
          shift_start?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          mobile?: string | null
          monthly_salary?: number
          pin?: string | null
          shift_start?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bill_items: {
        Row: {
          bill_id: string
          id: string
          item_type: string
          name: string
          product_id: string | null
          qty: number
          service_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          bill_id: string
          id?: string
          item_type: string
          name: string
          product_id?: string | null
          qty?: number
          service_id?: string | null
          total: number
          unit_price: number
        }
        Update: {
          bill_id?: string
          id?: string
          item_type?: string
          name?: string
          product_id?: string | null
          qty?: number
          service_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_paid: number
          barber_id: string | null
          bill_no: number
          client_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          discount_type: string | null
          discount_value: number
          due_amount: number
          id: string
          notes: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          barber_id?: string | null
          bill_no?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_type?: string | null
          discount_value?: number
          due_amount?: number
          id?: string
          notes?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          barber_id?: string | null
          bill_no?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          discount_type?: string | null
          discount_value?: number
          due_amount?: number
          id?: string
          notes?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          date_of_birth: string | null
          due_amount: number
          full_name: string
          gender: string | null
          id: string
          last_visit_at: string | null
          mobile: string
          notes: string | null
          total_spent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          due_amount?: number
          full_name: string
          gender?: string | null
          id?: string
          last_visit_at?: string | null
          mobile: string
          notes?: string | null
          total_spent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          due_amount?: number
          full_name?: string
          gender?: string | null
          id?: string
          last_visit_at?: string | null
          mobile?: string
          notes?: string | null
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      discount_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          min_spend: number | null
          name: string
          value: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          min_spend?: number | null
          name: string
          value: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          min_spend?: number | null
          name?: string
          value?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          payment_method: string | null
          spent_on: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          spent_on?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          spent_on?: string
          vendor?: string | null
        }
        Relationships: []
      }
      gift_card_transactions: {
        Row: {
          amount: number
          bill_id: string | null
          created_at: string
          gift_card_id: string
          id: string
          kind: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          created_at?: string
          gift_card_id: string
          id?: string
          kind: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          created_at?: string
          gift_card_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          balance: number
          client_id: string | null
          code: string
          created_at: string
          expires_on: string | null
          id: string
          initial_value: number
          status: string
        }
        Insert: {
          balance: number
          client_id?: string | null
          code: string
          created_at?: string
          expires_on?: string | null
          id?: string
          initial_value: number
          status?: string
        }
        Update: {
          balance?: number
          client_id?: string | null
          code?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          initial_value?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string
          id: string
          method: string
          paid_at: string
          reference_no: string | null
        }
        Insert: {
          amount: number
          bill_id: string
          id?: string
          method: string
          paid_at?: string
          reference_no?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string
          id?: string
          method?: string
          paid_at?: string
          reference_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          cost: number | null
          created_at: string
          id: string
          low_stock_threshold: number | null
          name: string
          price: number
          sku: string | null
          stock: number
        }
        Insert: {
          active?: boolean
          cost?: number | null
          created_at?: string
          id?: string
          low_stock_threshold?: number | null
          name: string
          price: number
          sku?: string | null
          stock?: number
        }
        Update: {
          active?: boolean
          cost?: number | null
          created_at?: string
          id?: string
          low_stock_threshold?: number | null
          name?: string
          price?: number
          sku?: string | null
          stock?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          channel: string | null
          client_id: string
          created_at: string
          id: string
          kind: string
          message: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          channel?: string | null
          client_id: string
          created_at?: string
          id?: string
          kind: string
          message: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string | null
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          message?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          barber_id: string
          base_salary: number
          created_at: string
          id: string
          incentive_amount: number
          incentive_pct: number
          overtime_amount: number
          paid_at: string | null
          period_month: number
          period_year: number
          revenue_generated: number
          total: number
        }
        Insert: {
          barber_id: string
          base_salary: number
          created_at?: string
          id?: string
          incentive_amount?: number
          incentive_pct?: number
          overtime_amount?: number
          paid_at?: string | null
          period_month: number
          period_year: number
          revenue_generated?: number
          total?: number
        }
        Update: {
          barber_id?: string
          base_salary?: number
          created_at?: string
          id?: string
          incentive_amount?: number
          incentive_pct?: number
          overtime_amount?: number
          paid_at?: string | null
          period_month?: number
          period_year?: number
          revenue_generated?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          duration_min: number | null
          id: string
          is_package: boolean
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          is_package?: boolean
          name: string
          price: number
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          is_package?: boolean
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      app_role: "admin" | "owner" | "barber"
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
      app_role: ["admin", "barber"],
    },
  },
} as const
