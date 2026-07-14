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
      addresses: {
        Row: {
          address_key: string
          city: string | null
          complement: string | null
          created_at: string
          house_number: string
          id: string
          neighborhood_id: string | null
          reference_point: string | null
          street_name: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address_key: string
          city?: string | null
          complement?: string | null
          created_at?: string
          house_number: string
          id?: string
          neighborhood_id?: string | null
          reference_point?: string | null
          street_name: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address_key?: string
          city?: string | null
          complement?: string | null
          created_at?: string
          house_number?: string
          id?: string
          neighborhood_id?: string | null
          reference_point?: string | null
          street_name?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_bills: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          is_recurring: boolean | null
          linked_stock_move_id: string | null
          notes: string | null
          paid_at: string | null
          paid_payment_method_id: string | null
          recurring_rule_id: string | null
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          is_recurring?: boolean | null
          linked_stock_move_id?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_payment_method_id?: string | null
          recurring_rule_id?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          is_recurring?: boolean | null
          linked_stock_move_id?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_payment_method_id?: string | null
          recurring_rule_id?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ap_bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_bills_linked_stock_move_id_fkey"
            columns: ["linked_stock_move_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_bills_paid_payment_method_id_fkey"
            columns: ["paid_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_bills_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      auto_reactivation_cycles: {
        Row: {
          attempt_count: number
          avg_days_at_cycle: number | null
          converted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string
          cycle_anchor_at: string
          id: string
          last_message_id: string | null
          last_sent_at: string | null
          next_due_at: string
          product_type: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          avg_days_at_cycle?: number | null
          converted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id: string
          cycle_anchor_at: string
          id?: string
          last_message_id?: string | null
          last_sent_at?: string | null
          next_due_at: string
          product_type: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          avg_days_at_cycle?: number | null
          converted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string
          cycle_anchor_at?: string
          id?: string
          last_message_id?: string | null
          last_sent_at?: string | null
          next_due_at?: string
          product_type?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reactivation_cycles_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reactivation_cycles_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "vw_orders_time_analysis"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "auto_reactivation_cycles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_reactivation_log: {
        Row: {
          attempt_number: number
          conversation_id: string | null
          customer_id: string | null
          cycle_id: string | null
          error_message: string | null
          id: string
          message_content: string
          message_id: string | null
          phone: string
          product_type: string
          sent_at: string
          status: string
        }
        Insert: {
          attempt_number: number
          conversation_id?: string | null
          customer_id?: string | null
          cycle_id?: string | null
          error_message?: string | null
          id?: string
          message_content: string
          message_id?: string | null
          phone: string
          product_type: string
          sent_at?: string
          status: string
        }
        Update: {
          attempt_number?: number
          conversation_id?: string | null
          customer_id?: string | null
          cycle_id?: string | null
          error_message?: string | null
          id?: string
          message_content?: string
          message_id?: string | null
          phone?: string
          product_type?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reactivation_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reactivation_log_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "auto_reactivation_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_reactivation_rules: {
        Row: {
          created_at: string
          followup_interval_days: number
          followup_message_template: string | null
          followup_whatsapp_template_id: string | null
          id: string
          is_active: boolean
          max_attempts: number
          max_avg_days: number
          message_template: string
          min_avg_days: number
          product_type: string
          rate_limit_per_run: number
          send_window_end: string
          send_window_start: string
          tolerance_days: number
          updated_at: string
          whatsapp_template_id: string | null
        }
        Insert: {
          created_at?: string
          followup_interval_days?: number
          followup_message_template?: string | null
          followup_whatsapp_template_id?: string | null
          id?: string
          is_active?: boolean
          max_attempts?: number
          max_avg_days?: number
          message_template: string
          min_avg_days?: number
          product_type: string
          rate_limit_per_run?: number
          send_window_end?: string
          send_window_start?: string
          tolerance_days?: number
          updated_at?: string
          whatsapp_template_id?: string | null
        }
        Update: {
          created_at?: string
          followup_interval_days?: number
          followup_message_template?: string | null
          followup_whatsapp_template_id?: string | null
          id?: string
          is_active?: boolean
          max_attempts?: number
          max_avg_days?: number
          message_template?: string
          min_avg_days?: number
          product_type?: string
          rate_limit_per_run?: number
          send_window_end?: string
          send_window_start?: string
          tolerance_days?: number
          updated_at?: string
          whatsapp_template_id?: string | null
        }
        Relationships: []
      }
      consumption_settings: {
        Row: {
          comparison_months: number
          created_at: string
          days_without_purchase: number
          drop_percent_threshold: number
          id: string
          min_purchases_for_regular: number
          monitored_product_ids: string[] | null
          updated_at: string
        }
        Insert: {
          comparison_months?: number
          created_at?: string
          days_without_purchase?: number
          drop_percent_threshold?: number
          id?: string
          min_purchases_for_regular?: number
          monitored_product_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          comparison_months?: number
          created_at?: string
          days_without_purchase?: number
          drop_percent_threshold?: number
          id?: string
          min_purchases_for_regular?: number
          monitored_product_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      container_balances: {
        Row: {
          id: string
          pool_id: string
          qty_empty: number
          qty_full: number
          qty_in_field: number
          updated_at: string
        }
        Insert: {
          id?: string
          pool_id: string
          qty_empty?: number
          qty_full?: number
          qty_in_field?: number
          updated_at?: string
        }
        Update: {
          id?: string
          pool_id?: string
          qty_empty?: number
          qty_full?: number
          qty_in_field?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_balances_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: true
            referencedRelation: "container_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      container_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_state: string | null
          id: string
          movement_type: string
          notes: string | null
          pool_id: string
          qty: number
          related_order_id: string | null
          to_state: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_state?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          pool_id: string
          qty: number
          related_order_id?: string | null
          to_state?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_state?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          pool_id?: string
          qty?: number
          related_order_id?: string | null
          to_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_movements_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "container_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_movements_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_movements_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "vw_orders_time_analysis"
            referencedColumns: ["order_id"]
          },
        ]
      }
      container_pools: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          total_physical_qty: number
          type: string
          unit_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          total_physical_qty?: number
          type: string
          unit_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          total_physical_qty?: number
          type?: string
          unit_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_entries: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          due_date: string
          id: string
          notes: string | null
          order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_orders_time_analysis"
            referencedColumns: ["order_id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          metadata: Json | null
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          type: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_recipients: {
        Row: {
          campaign_id: string
          conversation_id: string | null
          converted_at: string | null
          converted_order_id: string | null
          created_at: string
          customer_id: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          message_id: string | null
          name: string
          phone: string
          phone_normalized: string
          responded_at: string | null
          sent_at: string | null
          source: string
          status: string
          template_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          campaign_id: string
          conversation_id?: string | null
          converted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          name: string
          phone: string
          phone_normalized: string
          responded_at?: string | null
          sent_at?: string | null
          source: string
          status?: string
          template_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          campaign_id?: string
          conversation_id?: string | null
          converted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          name?: string
          phone?: string
          phone_normalized?: string
          responded_at?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_campaign_recipients_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "crm_campaign_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaign_templates: {
        Row: {
          body: string
          campaign_id: string
          conversion_count: number
          created_at: string
          id: string
          label: string
          response_count: number
          sent_count: number
          updated_at: string
          weight: number
          whatsapp_template_id: string | null
        }
        Insert: {
          body: string
          campaign_id: string
          conversion_count?: number
          created_at?: string
          id?: string
          label: string
          response_count?: number
          sent_count?: number
          updated_at?: string
          weight?: number
          whatsapp_template_id?: string | null
        }
        Update: {
          body?: string
          campaign_id?: string
          conversion_count?: number
          created_at?: string
          id?: string
          label?: string
          response_count?: number
          sent_count?: number
          updated_at?: string
          weight?: number
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaign_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campaigns: {
        Row: {
          attribution_days: number
          audience_summary: Json
          created_at: string
          created_by: string | null
          finished_at: string | null
          id: string
          name: string
          notes: string | null
          rate_limit_per_min: number
          scheduled_at: string | null
          send_window_end: string
          send_window_start: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attribution_days?: number
          audience_summary?: Json
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          name: string
          notes?: string | null
          rate_limit_per_min?: number
          scheduled_at?: string | null
          send_window_end?: string
          send_window_start?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attribution_days?: number
          audience_summary?: Json
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          rate_limit_per_min?: number
          scheduled_at?: string | null
          send_window_end?: string
          send_window_start?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_funnel_stages: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          id: string
          is_entry: boolean
          is_lost: boolean
          is_won: boolean
          name: string
          order_index: number
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_entry?: boolean
          is_lost?: boolean
          is_won?: boolean
          name: string
          order_index: number
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_entry?: boolean
          is_lost?: boolean
          is_won?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      crm_lead_tags: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          tag: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          tag: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          created_at: string | null
          customer_id: string | null
          email: string | null
          estimated_value: number | null
          id: string
          lost_reason: string | null
          name: string
          neighborhood_id: string | null
          notes: string | null
          phone: string | null
          product_interest: string | null
          source: string | null
          stage_changed_at: string | null
          stage_id: string
          updated_at: string | null
          whatsapp_conversation_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          lost_reason?: string | null
          name: string
          neighborhood_id?: string | null
          notes?: string | null
          phone?: string | null
          product_interest?: string | null
          source?: string | null
          stage_changed_at?: string | null
          stage_id: string
          updated_at?: string | null
          whatsapp_conversation_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          lost_reason?: string | null
          name?: string
          neighborhood_id?: string | null
          notes?: string | null
          phone?: string | null
          product_interest?: string | null
          source?: string | null
          stage_changed_at?: string | null
          stage_id?: string
          updated_at?: string | null
          whatsapp_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_recurrence_rules: {
        Row: {
          created_at: string | null
          days_since_last_order: number
          id: string
          is_active: boolean | null
          message_template: string
          name: string
          product_keyword: string | null
        }
        Insert: {
          created_at?: string | null
          days_since_last_order?: number
          id?: string
          is_active?: boolean | null
          message_template: string
          name: string
          product_keyword?: string | null
        }
        Update: {
          created_at?: string | null
          days_since_last_order?: number
          id?: string
          is_active?: boolean | null
          message_template?: string
          name?: string
          product_keyword?: string | null
        }
        Relationships: []
      }
      crm_tag_stage_mapping: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          source: string
          stage_id: string
          tag_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          source?: string
          stage_id: string
          tag_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          source?: string
          stage_id?: string
          tag_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tag_stage_mapping_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_timer_executions: {
        Row: {
          fired_at: string | null
          id: string
          lead_id: string
          stage_id: string
          trigger_id: string
        }
        Insert: {
          fired_at?: string | null
          id?: string
          lead_id: string
          stage_id: string
          trigger_id: string
        }
        Update: {
          fired_at?: string | null
          id?: string
          lead_id?: string
          stage_id?: string
          trigger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_timer_executions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_timer_executions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_timer_executions_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "crm_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_triggers: {
        Row: {
          action_type: string
          created_at: string | null
          delay_minutes: number | null
          filter_tags: string[]
          id: string
          is_active: boolean | null
          message_template: string | null
          name: string
          stage_id: string
          tags: string[] | null
          target_stage_id: string | null
          trigger_condition: string
          whatsapp_template_id: string | null
        }
        Insert: {
          action_type?: string
          created_at?: string | null
          delay_minutes?: number | null
          filter_tags?: string[]
          id?: string
          is_active?: boolean | null
          message_template?: string | null
          name: string
          stage_id: string
          tags?: string[] | null
          target_stage_id?: string | null
          trigger_condition?: string
          whatsapp_template_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          delay_minutes?: number | null
          filter_tags?: string[]
          id?: string
          is_active?: boolean | null
          message_template?: string | null
          name?: string
          stage_id?: string
          tags?: string[] | null
          target_stage_id?: string | null
          trigger_condition?: string
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_triggers_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_triggers_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_id: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean | null
        }
        Insert: {
          address_id: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean | null
        }
        Update: {
          address_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["consumption_alert_type"]
          created_at: string
          customer_id: string
          details: Json | null
          id: string
          period_ref: string
          severity: Database["public"]["Enums"]["alert_severity"]
          status: string
          updated_at: string
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["consumption_alert_type"]
          created_at?: string
          customer_id: string
          details?: Json | null
          id?: string
          period_ref: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: string
          updated_at?: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["consumption_alert_type"]
          created_at?: string
          customer_id?: string
          details?: Json | null
          id?: string
          period_ref?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_alerts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_monthly_consumption: {
        Row: {
          created_at: string
          customer_id: string
          gas_qty: number
          id: string
          other_qty: number
          total_orders: number
          total_value: number
          updated_at: string
          water_qty: number
          year_month: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          gas_qty?: number
          id?: string
          other_qty?: number
          total_orders?: number
          total_value?: number
          updated_at?: string
          water_qty?: number
          year_month: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          gas_qty?: number
          id?: string
          other_qty?: number
          total_orders?: number
          total_value?: number
          updated_at?: string
          water_qty?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_monthly_consumption_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_agg: {
        Row: {
          amount_total: number
          count_total: number
          customer_id: string
          id: string
          payment_method_id: string
          updated_at: string
        }
        Insert: {
          amount_total?: number
          count_total?: number
          customer_id: string
          id?: string
          payment_method_id: string
          updated_at?: string
        }
        Update: {
          amount_total?: number
          count_total?: number
          customer_id?: string
          id?: string
          payment_method_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_agg_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payment_agg_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_phones: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_primary: boolean | null
          is_whatsapp: boolean | null
          label: string | null
          phone_number: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_primary?: boolean | null
          is_whatsapp?: boolean | null
          label?: string | null
          phone_number: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_primary?: boolean | null
          is_whatsapp?: boolean | null
          label?: string | null
          phone_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_phones_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_agg: {
        Row: {
          amount_total: number
          customer_id: string
          id: string
          product_id: string
          qty_total: number
          updated_at: string
        }
        Insert: {
          amount_total?: number
          customer_id: string
          id?: string
          product_id: string
          qty_total?: number
          updated_at?: string
        }
        Update: {
          amount_total?: number
          customer_id?: string
          id?: string
          product_id?: string
          qty_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_agg_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_agg_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_assignments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          complement: string | null
          cpf: string | null
          created_at: string
          credit_balance: number | null
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean | null
          last_order_at: string | null
          name: string
          neighborhood_id: string | null
          notes: string | null
          number: string | null
          phone: string | null
          points_balance: number | null
          portal_password_hash: string | null
          reference: string | null
          street: string | null
          top_payment_method_id: string | null
          top_product_id: string | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          complement?: string | null
          cpf?: string | null
          created_at?: string
          credit_balance?: number | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_order_at?: string | null
          name: string
          neighborhood_id?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          points_balance?: number | null
          portal_password_hash?: string | null
          reference?: string | null
          street?: string | null
          top_payment_method_id?: string | null
          top_product_id?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          complement?: string | null
          cpf?: string | null
          created_at?: string
          credit_balance?: number | null
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_order_at?: string | null
          name?: string
          neighborhood_id?: string | null
          notes?: string | null
          number?: string | null
          phone?: string | null
          points_balance?: number | null
          portal_password_hash?: string | null
          reference?: string | null
          street?: string | null
          top_payment_method_id?: string | null
          top_product_id?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_top_payment_method_id_fkey"
            columns: ["top_payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_top_product_id_fkey"
            columns: ["top_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_summary: {
        Row: {
          avg_ticket: number | null
          cancelled_orders: number | null
          date: string
          delivered_orders: number | null
          id: string
          total_orders: number | null
          total_revenue: number | null
          updated_at: string
        }
        Insert: {
          avg_ticket?: number | null
          cancelled_orders?: number | null
          date: string
          delivered_orders?: number | null
          id?: string
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string
        }
        Update: {
          avg_ticket?: number | null
          cancelled_orders?: number | null
          date?: string
          delivered_orders?: number | null
          id?: string
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_people: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
        }
        Relationships: []
      }
      finance_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          payment_method_id: string | null
          source_id: string | null
          source_module: string
          transaction_date: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method_id?: string | null
          source_id?: string | null
          source_module: string
          transaction_date?: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payment_method_id?: string | null
          source_id?: string | null
          source_module?: string
          transaction_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_badge_awards: {
        Row: {
          awarded_at: string
          badge_id: string
          customer_id: string
          id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          customer_id: string
          id?: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_badge_awards_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "loyalty_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_badge_awards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_badges: {
        Row: {
          condition_type: string
          condition_value: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          condition_type?: string
          condition_value?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          condition_type?: string
          condition_value?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_campaigns: {
        Row: {
          bonus_points: number | null
          campaign_type: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          is_active: boolean | null
          multiplier: number
          name: string
          starts_at: string
          target_min_orders: number | null
          target_min_spent: number | null
          target_product_ids: string[] | null
          target_segment: string | null
          updated_at: string
        }
        Insert: {
          bonus_points?: number | null
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          is_active?: boolean | null
          multiplier?: number
          name: string
          starts_at?: string
          target_min_orders?: number | null
          target_min_spent?: number | null
          target_product_ids?: string[] | null
          target_segment?: string | null
          updated_at?: string
        }
        Update: {
          bonus_points?: number | null
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean | null
          multiplier?: number
          name?: string
          starts_at?: string
          target_min_orders?: number | null
          target_min_spent?: number | null
          target_product_ids?: string[] | null
          target_segment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_client_tokens: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string | null
          id: string
          last_accessed_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          last_accessed_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_client_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_coupons: {
        Row: {
          coupon_type: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          points_cost: number
          stock: number | null
          title: string
          updated_at: string
          whatsapp_message: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          coupon_type?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          points_cost: number
          stock?: number | null
          title: string
          updated_at?: string
          whatsapp_message?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          coupon_type?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          points_cost?: number
          stock?: number | null
          title?: string
          updated_at?: string
          whatsapp_message?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      loyalty_ledger: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          operator_id: string | null
          origin: string
          points: number
          reference_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          operator_id?: string | null
          origin: string
          points: number
          reference_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          operator_id?: string | null
          origin?: string
          points?: number
          reference_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_levels: {
        Row: {
          benefits: string | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          min_points: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          benefits?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          min_points?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          benefits?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          min_points?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_mission_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_value: number
          customer_id: string
          id: string
          mission_id: string
          rewarded: boolean | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_value?: number
          customer_id: string
          id?: string
          mission_id: string
          rewarded?: boolean | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_value?: number
          customer_id?: string
          id?: string
          mission_id?: string
          rewarded?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_mission_progress_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "loyalty_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_missions: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          id: string
          is_active: boolean | null
          mission_type: string
          reward_badge_id: string | null
          reward_points: number
          starts_at: string
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          is_active?: boolean | null
          mission_type?: string
          reward_badge_id?: string | null
          reward_points?: number
          starts_at?: string
          target_value?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean | null
          mission_type?: string
          reward_badge_id?: string | null
          reward_points?: number
          starts_at?: string
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_missions_reward_badge_id_fkey"
            columns: ["reward_badge_id"]
            isOneToOne: false
            referencedRelation: "loyalty_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_referrals: {
        Row: {
          bonus_referred: number
          bonus_referrer: number
          completed_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_customer_id: string | null
          referred_phone: string
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          bonus_referred?: number
          bonus_referrer?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_customer_id?: string | null
          referred_phone: string
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_referred?: number
          bonus_referrer?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_customer_id?: string | null
          referred_phone?: string
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_referrals_referred_customer_id_fkey"
            columns: ["referred_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_scoring_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          min_purchase_value: number | null
          points_value: number
          product_id: string | null
          rule_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          min_purchase_value?: number | null
          points_value?: number
          product_id?: string | null
          rule_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          min_purchase_value?: number | null
          points_value?: number
          product_id?: string | null
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_scoring_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_vouchers: {
        Row: {
          code: string
          coupon_id: string
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          points_spent: number
          redeemed_at: string
          reversed_at: string | null
          reversed_by: string | null
          status: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          code: string
          coupon_id: string
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          points_spent: number
          redeemed_at?: string
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          code?: string
          coupon_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          points_spent?: number
          redeemed_at?: string
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_vouchers_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "loyalty_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_vouchers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_bonuses: {
        Row: {
          bonus_percent: number
          bonus_qty: number
          bonus_value_brl: number
          competence_month: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          pool_id: string
          qty_filled: number
          status: string
          updated_at: string
        }
        Insert: {
          bonus_percent?: number
          bonus_qty?: number
          bonus_value_brl?: number
          competence_month: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          pool_id: string
          qty_filled?: number
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_percent?: number
          bonus_qty?: number
          bonus_value_brl?: number
          competence_month?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          pool_id?: string
          qty_filled?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_bonuses_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "container_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          created_at: string
          delivery_fee: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_fee?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_fee?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_orders_time_analysis"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          payment_method_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id: string
          payment_method_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          payment_method_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_orders_time_analysis"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          channel_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_complement: string | null
          delivery_fee: number | null
          delivery_number: string | null
          delivery_person_id: string | null
          delivery_reference: string | null
          discount: number | null
          due_date: string | null
          id: string
          neighborhood_id: string | null
          notes: string | null
          order_number: number
          paid_at: string | null
          payment_method_id: string | null
          requested_by_label: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_complement?: string | null
          delivery_fee?: number | null
          delivery_number?: string | null
          delivery_person_id?: string | null
          delivery_reference?: string | null
          discount?: number | null
          due_date?: string | null
          id?: string
          neighborhood_id?: string | null
          notes?: string | null
          order_number?: number
          paid_at?: string | null
          payment_method_id?: string | null
          requested_by_label?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_complement?: string | null
          delivery_fee?: number | null
          delivery_number?: string | null
          delivery_person_id?: string | null
          delivery_reference?: string | null
          discount?: number | null
          due_date?: string | null
          id?: string
          neighborhood_id?: string | null
          notes?: string | null
          order_number?: number
          paid_at?: string | null
          payment_method_id?: string | null
          requested_by_label?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_person_id_fkey"
            columns: ["delivery_person_id"]
            isOneToOne: false
            referencedRelation: "delivery_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          is_credit: boolean | null
          name: string
          requires_change: boolean | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_credit?: boolean | null
          name: string
          requires_change?: boolean | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_credit?: boolean | null
          name?: string
          requires_change?: boolean | null
        }
        Relationships: []
      }
      portal_link_sends: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          operator_id: string
          send_method: string
          token: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          operator_id: string
          send_method?: string
          token?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          operator_id?: string
          send_method?: string
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_link_sends_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_otp_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone: string
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone: string
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      product_channel_prices: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          price?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_channel_prices_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_channel_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_payment_prices: {
        Row: {
          created_at: string
          id: string
          payment_method_id: string
          price: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_method_id: string
          price?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_method_id?: string
          price?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_payment_prices_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_payment_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          bonus_percent: number | null
          container_pool_id: string | null
          cost: number | null
          created_at: string
          current_stock: number | null
          has_returnable_container: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          min_stock: number | null
          name: string
          price: number
          reserved_stock: number | null
          sku: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          bonus_percent?: number | null
          container_pool_id?: string | null
          cost?: number | null
          created_at?: string
          current_stock?: number | null
          has_returnable_container?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_stock?: number | null
          name: string
          price?: number
          reserved_stock?: number | null
          sku?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          bonus_percent?: number | null
          container_pool_id?: string | null
          cost?: number | null
          created_at?: string
          current_stock?: number | null
          has_returnable_container?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_stock?: number | null
          name?: string
          price?: number
          reserved_stock?: number | null
          sku?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_container_pool_id_fkey"
            columns: ["container_pool_id"]
            isOneToOne: false
            referencedRelation: "container_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_rules: {
        Row: {
          amount_default: number
          category_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number
          id: string
          is_active: boolean | null
          name: string
          type: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount_default?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month: number
          id?: string
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount_default?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_channels: {
        Row: {
          created_at: string
          delivery_fee: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          order_fee: number | null
        }
        Insert: {
          created_at?: string
          delivery_fee?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_fee?: number | null
        }
        Update: {
          created_at?: string
          delivery_fee?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_fee?: number | null
        }
        Relationships: []
      }
      sales_goals: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          metric: string
          name: string | null
          product_id: string | null
          target_value: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          metric: string
          name?: string | null
          product_id?: string | null
          target_value?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          metric?: string
          name?: string | null
          product_id?: string | null
          target_value?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          is_paid: boolean | null
          new_stock: number | null
          order_id: string | null
          previous_stock: number | null
          product_id: string
          purchase_value: number | null
          quantity: number
          reason: string | null
          type: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_paid?: boolean | null
          new_stock?: number | null
          order_id?: string | null
          previous_stock?: number | null
          product_id: string
          purchase_value?: number | null
          quantity: number
          reason?: string | null
          type: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          is_paid?: boolean | null
          new_stock?: number | null
          order_id?: string | null
          previous_stock?: number | null
          product_id?: string
          purchase_value?: number | null
          quantity?: number
          reason?: string | null
          type?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_orders_time_analysis"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      streets_index: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          neighborhood_id: string | null
          street_name: string
          street_name_normalized: string
          street_type: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          neighborhood_id?: string | null
          street_name: string
          street_name_normalized: string
          street_type?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          neighborhood_id?: string | null
          street_name?: string
          street_name_normalized?: string
          street_type?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "streets_index_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
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
      vendors: {
        Row: {
          created_at: string
          default_terms: number | null
          document: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_terms?: number | null
          document?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_terms?: number | null
          document?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          meta_access_token: string | null
          meta_api_version: string
          meta_app_secret: string | null
          meta_phone_number_id: string | null
          meta_verify_token: string | null
          meta_waba_id: string | null
          phone: string | null
          provider: string
          status: string
          token: string
          updated_at: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id?: string
          meta_access_token?: string | null
          meta_api_version?: string
          meta_app_secret?: string | null
          meta_phone_number_id?: string | null
          meta_verify_token?: string | null
          meta_waba_id?: string | null
          phone?: string | null
          provider?: string
          status?: string
          token?: string
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          meta_access_token?: string | null
          meta_api_version?: string
          meta_app_secret?: string | null
          meta_phone_number_id?: string | null
          meta_verify_token?: string | null
          meta_waba_id?: string | null
          phone?: string | null
          provider?: string
          status?: string
          token?: string
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body_preview: string
          category: string
          created_at: string
          header_type: string | null
          id: string
          is_active: boolean
          language: string
          name: string
          status: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body_preview: string
          category?: string
          created_at?: string
          header_type?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name: string
          status?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body_preview?: string
          category?: string
          created_at?: string
          header_type?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          status?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          chat_lid: string | null
          contact_name: string | null
          created_at: string
          customer_id: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          phone: string
          profile_picture_url: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          chat_lid?: string | null
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          phone: string
          profile_picture_url?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          chat_lid?: string | null
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          phone?: string
          profile_picture_url?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_templates: {
        Row: {
          body: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          media_url: string | null
          message_id: string | null
          sent_by: string | null
          status: string
          type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          media_url?: string | null
          message_id?: string | null
          sent_by?: string | null
          status?: string
          type?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          media_url?: string | null
          message_id?: string | null
          sent_by?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_quick_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          shortcut: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          shortcut: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          shortcut?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_customers_by_street: {
        Row: {
          address_id: string | null
          complement: string | null
          customer_id: string | null
          customer_name: string | null
          house_number: string | null
          is_default: boolean | null
          neighborhood_name: string | null
          phone_primary: string | null
          reference_point: string | null
          street_name: string | null
          street_name_normalized: string | null
        }
        Relationships: []
      }
      vw_orders_time_analysis: {
        Row: {
          channel_id: string | null
          created_at: string | null
          customer_id: string | null
          day_name: string | null
          day_of_week: number | null
          delivered_at: string | null
          delivery_person_id: string | null
          hour_of_day: number | null
          item_total: number | null
          order_id: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          time_slot: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_person_id_fkey"
            columns: ["delivery_person_id"]
            isOneToOne: false
            referencedRelation: "delivery_people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      crm_get_pending_timer_leads: {
        Args: never
        Returns: {
          action_type: string
          filter_tags: string[]
          lead_id: string
          lead_name: string
          lead_phone: string
          message_template: string
          stage_id: string
          tags: string[]
          target_stage_id: string
          trigger_id: string
          trigger_name: string
          whatsapp_template_id: string
        }[]
      }
      get_campaign_metrics: { Args: { p_campaign_id: string }; Returns: Json }
      get_crm_trigger_metrics: {
        Args: { p_end?: string; p_start?: string }
        Returns: Json
      }
      get_reactivation_candidates: {
        Args: {
          p_limit: number
          p_max_avg: number
          p_min_avg: number
          p_min_samples: number
          p_product_type: string
          p_tolerance: number
        }
        Returns: {
          avg_days: number
          customer_id: string
          customer_name: string
          customer_phone: string
          days_since: number
          last_order_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      link_whatsapp_conversations_to_customer: {
        Args: { p_customer_id: string; p_phone: string }
        Returns: number
      }
      normalize_address_key: {
        Args: { p_neighborhood_id: string; p_number: string; p_street: string }
        Returns: string
      }
      normalize_phone_for_match: { Args: { p: string }; Returns: string }
      normalize_street_name: { Args: { p_street: string }; Returns: string }
      parse_street_type: {
        Args: { p_street: string }
        Returns: {
          street_name: string
          street_type: string
        }[]
      }
      phone_match_variants: { Args: { p: string }; Returns: string[] }
      search_addresses_autocomplete: {
        Args: { p_limit?: number; p_search: string }
        Returns: {
          address_id: string
          customer_id: string
          customer_name: string
          customer_phone: string
          display_text: string
          house_number: string
          neighborhood_id: string
          neighborhood_name: string
          street_name: string
          street_type: string
          suggestion_type: string
          usage_count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      alert_severity: "low" | "medium" | "high"
      app_role: "admin" | "manager" | "operator" | "finance" | "deliverer"
      consumption_alert_type:
        | "water_drop"
        | "gas_drop"
        | "water_stopped"
        | "gas_stopped"
        | "product_stopped"
        | "general_risk"
      order_status:
        | "accepted"
        | "preparing"
        | "sent"
        | "delivered"
        | "cancelled"
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
      alert_severity: ["low", "medium", "high"],
      app_role: ["admin", "manager", "operator", "finance", "deliverer"],
      consumption_alert_type: [
        "water_drop",
        "gas_drop",
        "water_stopped",
        "gas_stopped",
        "product_stopped",
        "general_risk",
      ],
      order_status: ["accepted", "preparing", "sent", "delivered", "cancelled"],
    },
  },
} as const
