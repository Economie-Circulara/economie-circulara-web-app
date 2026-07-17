export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      certificates: {
        Row: {
          created_at: string;
          id: string;
          issued_at: string;
          number: string;
          order_id: string;
          organization_id: string;
          pdf_path: string | null;
          traceability_snapshot: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          issued_at?: string;
          number: string;
          order_id: string;
          organization_id: string;
          pdf_path?: string | null;
          traceability_snapshot?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          issued_at?: string;
          number?: string;
          order_id?: string;
          organization_id?: string;
          pdf_path?: string | null;
          traceability_snapshot?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "certificates_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "certificates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_addresses: {
        Row: {
          address: string;
          client_id: string;
          created_at: string;
          id: string;
          is_default: boolean;
          label: string | null;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          address: string;
          client_id: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          label?: string | null;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_addresses_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_addresses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          contact_person: string | null;
          created_at: string;
          cui: string;
          email: string | null;
          hq_address: string | null;
          id: string;
          is_supplier: boolean;
          is_vat_payer: boolean;
          name: string;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          reg_com: string | null;
          updated_at: string;
        };
        Insert: {
          contact_person?: string | null;
          created_at?: string;
          cui: string;
          email?: string | null;
          hq_address?: string | null;
          id?: string;
          is_supplier?: boolean;
          is_vat_payer?: boolean;
          name: string;
          notes?: string | null;
          organization_id: string;
          phone?: string | null;
          reg_com?: string | null;
          updated_at?: string;
        };
        Update: {
          contact_person?: string | null;
          created_at?: string;
          cui?: string;
          email?: string | null;
          hq_address?: string | null;
          id?: string;
          is_supplier?: boolean;
          is_vat_payer?: boolean;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          reg_com?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          created_at: string;
          description: string | null;
          file_name: string;
          file_path: string;
          id: string;
          mime_type: string | null;
          organization_id: string;
          owner_id: string;
          owner_type: Database["public"]["Enums"]["document_owner_type"];
          size_bytes: number | null;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          file_name: string;
          file_path: string;
          id?: string;
          mime_type?: string | null;
          organization_id: string;
          owner_id: string;
          owner_type: Database["public"]["Enums"]["document_owner_type"];
          size_bytes?: number | null;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          file_name?: string;
          file_path?: string;
          id?: string;
          mime_type?: string | null;
          organization_id?: string;
          owner_id?: string;
          owner_type?: Database["public"]["Enums"]["document_owner_type"];
          size_bytes?: number | null;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          kind: Database["public"]["Enums"]["item_kind"];
          organization_id: string;
          sellable: boolean;
          title: string;
          unit: Database["public"]["Enums"]["unit_of_measure"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          kind?: Database["public"]["Enums"]["item_kind"];
          organization_id: string;
          sellable?: boolean;
          title: string;
          unit: Database["public"]["Enums"]["unit_of_measure"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          kind?: Database["public"]["Enums"]["item_kind"];
          organization_id?: string;
          sellable?: boolean;
          title?: string;
          unit?: Database["public"]["Enums"]["unit_of_measure"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      lots: {
        Row: {
          block_reason: string | null;
          created_at: string;
          entry_date: string;
          id: string;
          initial_qty: number;
          is_blocked: boolean;
          item_id: string;
          location: string | null;
          organization_id: string;
          provenance: Database["public"]["Enums"]["lot_provenance"];
          quality_status: Database["public"]["Enums"]["quality_status"];
          remaining_qty: number;
          source: string | null;
          updated_at: string;
        };
        Insert: {
          block_reason?: string | null;
          created_at?: string;
          entry_date?: string;
          id?: string;
          initial_qty: number;
          is_blocked?: boolean;
          item_id: string;
          location?: string | null;
          organization_id: string;
          provenance: Database["public"]["Enums"]["lot_provenance"];
          quality_status?: Database["public"]["Enums"]["quality_status"];
          remaining_qty: number;
          source?: string | null;
          updated_at?: string;
        };
        Update: {
          block_reason?: string | null;
          created_at?: string;
          entry_date?: string;
          id?: string;
          initial_qty?: number;
          is_blocked?: boolean;
          item_id?: string;
          location?: string | null;
          organization_id?: string;
          provenance?: Database["public"]["Enums"]["lot_provenance"];
          quality_status?: Database["public"]["Enums"]["quality_status"];
          remaining_qty?: number;
          source?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lots_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lots_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // --- Task E (Comenzi) — supabase/migrations/0007_orders_ops.sql ---
      // Adaugat manual (fara acces la `pnpm gen:types` in acest mediu) — vezi nota
      // similara la Functions.create_lot (Task C) mai jos.
      order_counters: {
        Row: {
          organization_id: string;
          seq: number;
          updated_at: string;
          year: number;
        };
        Insert: {
          organization_id: string;
          seq?: number;
          updated_at?: string;
          year: number;
        };
        Update: {
          organization_id?: string;
          seq?: number;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_counters_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          order_id: string;
          organization_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          order_id: string;
          organization_id: string;
          quantity: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          order_id?: string;
          organization_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      order_links: {
        Row: {
          created_at: string;
          id: string;
          link_type: Database["public"]["Enums"]["order_link_type"];
          linked_order_id: string;
          organization_id: string;
          original_order_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          link_type: Database["public"]["Enums"]["order_link_type"];
          linked_order_id: string;
          organization_id: string;
          original_order_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          link_type?: Database["public"]["Enums"]["order_link_type"];
          linked_order_id?: string;
          organization_id?: string;
          original_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_links_linked_order_id_fkey";
            columns: ["linked_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_links_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_links_original_order_id_fkey";
            columns: ["original_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          created_by_admin: boolean;
          delivery_address_id: string | null;
          delivery_date: string | null;
          expected_return_date: string | null;
          id: string;
          notes: string | null;
          order_number: string | null;
          organization_id: string;
          status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          created_by_admin?: boolean;
          delivery_address_id?: string | null;
          delivery_date?: string | null;
          expected_return_date?: string | null;
          id?: string;
          notes?: string | null;
          order_number?: string | null;
          organization_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          created_by_admin?: boolean;
          delivery_address_id?: string | null;
          delivery_date?: string | null;
          expected_return_date?: string | null;
          id?: string;
          notes?: string | null;
          order_number?: string | null;
          organization_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey";
            columns: ["delivery_address_id"];
            isOneToOne: false;
            referencedRelation: "client_addresses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          custom_domain: string | null;
          email_from_address: string | null;
          email_from_name: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          primary_color: string | null;
          secondary_color: string | null;
          slug: string;
          status: Database["public"]["Enums"]["org_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          custom_domain?: string | null;
          email_from_address?: string | null;
          email_from_name?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["org_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          custom_domain?: string | null;
          email_from_address?: string | null;
          email_from_name?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["org_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      process_inputs: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          lot_id: string;
          organization_id: string;
          process_id: string;
          quantity: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          lot_id: string;
          organization_id: string;
          process_id: string;
          quantity: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          lot_id?: string;
          organization_id?: string;
          process_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "process_inputs_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "process_inputs_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "lots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "process_inputs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "process_inputs_process_id_fkey";
            columns: ["process_id"];
            isOneToOne: false;
            referencedRelation: "processes";
            referencedColumns: ["id"];
          },
        ];
      };
      process_outputs: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          lot_id: string;
          organization_id: string;
          process_id: string;
          quantity: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          lot_id: string;
          organization_id: string;
          process_id: string;
          quantity: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          lot_id?: string;
          organization_id?: string;
          process_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "process_outputs_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "process_outputs_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "lots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "process_outputs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "process_outputs_process_id_fkey";
            columns: ["process_id"];
            isOneToOne: false;
            referencedRelation: "processes";
            referencedColumns: ["id"];
          },
        ];
      };
      processes: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          output_item_id: string | null;
          recipe_id: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["process_status"];
          type: Database["public"]["Enums"]["process_type"];
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          output_item_id?: string | null;
          recipe_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["process_status"];
          type: Database["public"]["Enums"]["process_type"];
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          output_item_id?: string | null;
          recipe_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["process_status"];
          type?: Database["public"]["Enums"]["process_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "processes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "processes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "processes_output_item_id_fkey";
            columns: ["output_item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "processes_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          client_id: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          organization_id: string | null;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["org_status"];
          updated_at: string;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          organization_id?: string | null;
          role: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["org_status"];
          updated_at?: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          organization_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["org_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_components: {
        Row: {
          component_item_id: string;
          created_at: string;
          id: string;
          organization_id: string;
          percentage: number;
          recipe_id: string;
          updated_at: string;
        };
        Insert: {
          component_item_id: string;
          created_at?: string;
          id?: string;
          organization_id: string;
          percentage: number;
          recipe_id: string;
          updated_at?: string;
        };
        Update: {
          component_item_id?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          percentage?: number;
          recipe_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_components_component_item_id_fkey";
            columns: ["component_item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_components_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_components_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          item_id: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          item_id?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: true;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_events: {
        Row: {
          created_at: string;
          created_by: string | null;
          event_type: Database["public"]["Enums"]["stock_event_type"];
          id: string;
          item_id: string;
          lot_id: string | null;
          order_id: string | null;
          organization_id: string;
          process_id: string | null;
          quantity: number;
          reason: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          event_type: Database["public"]["Enums"]["stock_event_type"];
          id?: string;
          item_id: string;
          lot_id?: string | null;
          order_id?: string | null;
          organization_id: string;
          process_id?: string | null;
          quantity: number;
          reason?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          event_type?: Database["public"]["Enums"]["stock_event_type"];
          id?: string;
          item_id?: string;
          lot_id?: string | null;
          order_id?: string | null;
          organization_id?: string;
          process_id?: string | null;
          quantity?: number;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_events_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_events_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "lots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_events_process_id_fkey";
            columns: ["process_id"];
            isOneToOne: false;
            referencedRelation: "processes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      org_branding: {
        Args: { p_domain?: string; p_slug?: string };
        Returns: {
          custom_domain: string;
          id: string;
          logo_url: string;
          name: string;
          primary_color: string;
          secondary_color: string;
          slug: string;
        }[];
      };
      // --- Task C (Stoc & Loturi) — supabase/migrations/0004_stock_service.sql ---
      // Adaugate manual (fara acces la `pnpm gen:types` in acest mediu). La urmatoarea
      // rulare locala a `pnpm gen:types` aceste intrari trebuie sa ramana identice cu
      // ce genereaza CLI-ul din DB — daca difera, migrarea are prioritate.
      create_lot: {
        Args: {
          p_entry_date?: string | null;
          p_item_id: string;
          p_location?: string | null;
          p_provenance: Database["public"]["Enums"]["lot_provenance"];
          p_quality_status?: Database["public"]["Enums"]["quality_status"] | null;
          p_quantity: number;
          p_reason?: string | null;
          p_source?: string | null;
        };
        Returns: Database["public"]["Tables"]["lots"]["Row"];
      };
      consume_fifo: {
        Args: {
          p_event_type?: Database["public"]["Enums"]["stock_event_type"] | null;
          p_item_id: string;
          p_manual_lot_ids?: string[] | null;
          p_order_id?: string | null;
          p_process_id?: string | null;
          p_qty: number;
          p_reason?: string | null;
        };
        Returns: { lot_id: string; qty: number }[];
      };
      set_lot_block: {
        Args: { p_blocked: boolean; p_lot_id: string; p_reason?: string | null };
        Returns: Database["public"]["Tables"]["lots"]["Row"];
      };
      // --- Task E (Comenzi) — supabase/migrations/0007_orders_ops.sql ---
      // Adaugate manual (fara acces la `pnpm gen:types` in acest mediu). La urmatoarea
      // rulare locala a `pnpm gen:types` aceste intrari trebuie sa ramana identice cu
      // ce genereaza CLI-ul din DB — daca difera, migrarea are prioritate.
      generate_order_number: {
        Args: { p_org: string };
        Returns: string;
      };
      accept_order: {
        Args: { p_order_id: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      cancel_order: {
        Args: { p_order_id: string };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      // --- Task D (Productie & Reciclare) — supabase/migrations/0008_reconditioning.sql ---
      // RPC de finalizare proces: creeaza randul `processes` + consuma FIFO/manual
      // inputurile (consume_fifo) + creeaza loturile de output (create_lot) +
      // inregistreaza process_inputs/process_outputs, atomic (o singura tranzactie).
      // p_inputs/p_outputs sunt array-uri JSON (vezi src/features/production/service.ts).
      confirm_process: {
        Args: {
          p_inputs: Json;
          p_notes?: string | null;
          p_outputs: Json;
          p_output_item_id: string;
          p_recipe_id?: string | null;
          p_type: Database["public"]["Enums"]["process_type"];
        };
        Returns: Database["public"]["Tables"]["processes"]["Row"];
      };
      cancel_process: {
        Args: { p_process_id: string };
        Returns: Database["public"]["Tables"]["processes"]["Row"];
      };
    };
    Enums: {
      document_owner_type: "client" | "order" | "item";
      // --- Task B (Itemi/Retete) — supabase/migrations/0005_item_kind.sql ---
      item_kind: "physical" | "service";
      lot_provenance:
        | "purchase"
        | "internal_production"
        | "recycling"
        | "return"
        | "inventory_adjustment"
        // --- Task D — supabase/migrations/0008_reconditioning.sql (ALTER TYPE ADD VALUE) ---
        | "reconditioning";
      order_link_type: "return" | "warranty" | "replacement";
      order_status: "draft" | "sent" | "accepted" | "delivered" | "closed" | "cancelled";
      org_status: "active" | "suspended";
      process_status:
        | "planned"
        | "in_progress"
        | "awaiting_confirmation"
        | "completed"
        | "cancelled";
      process_type: "output_fixed" | "input_fixed";
      quality_status: "unchecked" | "passed" | "failed";
      stock_event_type: "intake" | "consumption" | "adjustment" | "block" | "unblock" | "reversal";
      unit_of_measure: "kg" | "tona" | "mc" | "litru" | "bucata" | "sac" | "palet";
      user_role: "super_admin" | "admin" | "operator" | "client";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      document_owner_type: ["client", "order", "item"],
      item_kind: ["physical", "service"],
      lot_provenance: [
        "purchase",
        "internal_production",
        "recycling",
        "return",
        "inventory_adjustment",
        "reconditioning",
      ],
      order_link_type: ["return", "warranty", "replacement"],
      order_status: ["draft", "sent", "accepted", "delivered", "closed", "cancelled"],
      org_status: ["active", "suspended"],
      process_status: ["planned", "in_progress", "awaiting_confirmation", "completed", "cancelled"],
      process_type: ["output_fixed", "input_fixed"],
      quality_status: ["unchecked", "passed", "failed"],
      stock_event_type: ["intake", "consumption", "adjustment", "block", "unblock", "reversal"],
      unit_of_measure: ["kg", "tona", "mc", "litru", "bucata", "sac", "palet"],
      user_role: ["super_admin", "admin", "operator", "client"],
    },
  },
} as const;
