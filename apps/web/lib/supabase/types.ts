export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          api_key: string;
          plan: "free" | "starter" | "pro";
          is_developer: boolean;
          phone_number: string | null;
          phone_verified: boolean;
          phone_verified_at: string | null;
          email_verified: boolean;
          razorpay_customer_id: string | null;
          razorpay_subscription_id: string | null;
          razorpay_subscription_status: string | null;
          credit_balance: number;
          billing_cycle_anchor: string | null;
          plan_credits_per_cycle: number;
          plan_rollover_cap: number;
          sui_address: string | null;
          privy_did: string | null;
          migration_status: "legacy" | "migrating" | "migrated";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          api_key?: string;
          plan?: "free" | "starter" | "pro";
          is_developer?: boolean;
          phone_number?: string | null;
          phone_verified?: boolean;
          phone_verified_at?: string | null;
          email_verified?: boolean;
          razorpay_customer_id?: string | null;
          razorpay_subscription_id?: string | null;
          razorpay_subscription_status?: string | null;
          credit_balance?: number;
          billing_cycle_anchor?: string | null;
          plan_credits_per_cycle?: number;
          plan_rollover_cap?: number;
          sui_address?: string | null;
          privy_did?: string | null;
          migration_status?: "legacy" | "migrating" | "migrated";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          api_key?: string;
          plan?: "free" | "starter" | "pro";
          is_developer?: boolean;
          phone_number?: string | null;
          phone_verified?: boolean;
          phone_verified_at?: string | null;
          email_verified?: boolean;
          razorpay_customer_id?: string | null;
          razorpay_subscription_id?: string | null;
          razorpay_subscription_status?: string | null;
          credit_balance?: number;
          billing_cycle_anchor?: string | null;
          plan_credits_per_cycle?: number;
          plan_rollover_cap?: number;
          sui_address?: string | null;
          privy_did?: string | null;
          migration_status?: "legacy" | "migrating" | "migrated";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      developer_profiles: {
        Row: {
          id: string;
          user_id: string;
          developer_name: string;
          bio: string | null;
          website: string | null;
          github_username: string | null;
          razorpay_account_id: string | null;
          payouts_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          developer_name: string;
          bio?: string | null;
          website?: string | null;
          github_username?: string | null;
          razorpay_account_id?: string | null;
          payouts_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          developer_name?: string;
          bio?: string | null;
          website?: string | null;
          github_username?: string | null;
          razorpay_account_id?: string | null;
          payouts_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "developer_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      credit_ledger: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: string;
          description: string;
          expires_at: string | null;
          remaining: number | null;
          razorpay_invoice_id: string | null;
          razorpay_payment_id: string | null;
          mcp_server_id: string | null;
          tool_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          type: string;
          description: string;
          expires_at?: string | null;
          remaining?: number | null;
          razorpay_invoice_id?: string | null;
          razorpay_payment_id?: string | null;
          mcp_server_id?: string | null;
          tool_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          type?: string;
          description?: string;
          expires_at?: string | null;
          remaining?: number | null;
          razorpay_invoice_id?: string | null;
          razorpay_payment_id?: string | null;
          mcp_server_id?: string | null;
          tool_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      mcp_servers: {
        Row: {
          id: string;
          developer_id: string;
          namespace: string;
          name: string;
          description: string;
          long_description: string | null;
          icon_url: string | null;
          category: string | null;
          tags: string[];
          trigger_phrases: string[];
          server_type: "internal" | "external";
          endpoint_url: string | null;
          internal_route: string | null;
          status: string;
          is_featured: boolean;
          total_calls: number;
          total_users: number;
          avg_rating: number;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      mcp_tools: {
        Row: {
          id: string;
          server_id: string;
          tool_name: string;
          description: string;
          input_schema: Record<string, unknown>;
          credit_cost: number;
          requires_phone: boolean;
          is_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_enabled_servers: {
        Row: {
          id: string;
          user_id: string;
          server_id: string;
          enabled_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          server_id: string;
          enabled_at?: string;
        };
        Update: Record<string, unknown>;
        Relationships: [];
      };
      request_log: {
        Row: {
          id: string;
          user_id: string;
          server_id: string | null;
          tool_id: string | null;
          tool_name: string;
          namespace: string;
          credit_cost: number;
          latency_ms: number | null;
          status: string;
          error_message: string | null;
          request_meta: Record<string, unknown>;
          response_meta: Record<string, unknown>;
          created_at: string;
          chain_id: string | null;
          receipt_object_id: string | null;
          tx_digest: string | null;
          session_object_id: string | null;
          amount_atomic: number | string | null;
          dev_share_atomic: number | string | null;
          treasury_share_atomic: number | string | null;
          insurance_share_atomic: number | string | null;
          receipt_blob_id: string | null;
          intent_object_id: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      discover_usage: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          results_count: number;
          credited: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          results_count?: number;
          credited?: boolean;
          created_at?: string;
        };
        Update: Record<string, unknown>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          server_id: string;
          rating: number;
          review_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          server_id: string;
          rating: number;
          review_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          server_id?: string;
          rating?: number;
          review_text?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_server_id_fkey";
            columns: ["server_id"];
            isOneToOne: false;
            referencedRelation: "mcp_servers";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      chain_balances: {
        Row: {
          session_object_id: string;
          chain_id: string;
          user_id: string | null;
          owner_address: string;
          balance_atomic: number | string;
          per_call_cap_atomic: number | string;
          per_day_cap_atomic: number | string;
          today_spent_atomic: number | string;
          today_epoch_day: number | null;
          scoped_server_object_ids: string[] | null;
          expires_at_ms: number | null;
          active: boolean;
          lifetime_deposited_atomic: number | string;
          lifetime_spent_atomic: number | string;
          last_tx_digest: string | null;
          last_synced_at: string | null;
        };
        Relationships: [];
      };
      developer_vaults: {
        Row: {
          vault_object_id: string;
          chain_id: string;
          developer_id: string | null;
          owner_address: string;
          accrued_balance_atomic: number | string;
          lifetime_earnings_atomic: number | string;
          lifetime_claimed_atomic: number | string;
          auto_claim_threshold_atomic: number | string;
          last_tx_digest: string | null;
        };
        Relationships: [];
      };
      marketplace_servers: {
        Row: {
          object_id: string;
          namespace: string;
          name: string | null;
          description: string | null;
          category: string | null;
          owner_address: string | null;
          endpoint_url: string | null;
          metadata_blob_id: string | null;
          tx_digest: string | null;
          on_chain_version: number | null;
          tool_count: number | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      dashboard_usage: {
        Row: {
          owner_address: string | null;
          user_id: string | null;
          calls: number | null;
          gross_atomic: number | string | null;
          dev_atomic: number | string | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      bundles_public: {
        Row: {
          bundle_object_id: string;
          name: string | null;
          creator_address: string;
          server_count: number;
          price_multiplier_x100: number;
          metadata_blob_id: string | null;
          active: boolean;
          tx_digest: string | null;
          created_at: string | null;
          discount_pct: number;
        };
        Relationships: [];
      };
      live_feed_24h: {
        Row: {
          tx_digest: string | null;
          namespace: string | null;
          tool_name: string | null;
          amount_atomic: number | string | null;
          created_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
