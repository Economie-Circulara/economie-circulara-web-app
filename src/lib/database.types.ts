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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_tool_calls: {
        Row: {
          arguments: Json
          confirmed_by: string | null
          conversation_id: string
          created_at: string
          error: string | null
          id: string
          resolved_at: string | null
          result: Json | null
          status: string
          tool: string
        }
        Insert: {
          arguments?: Json
          confirmed_by?: string | null
          conversation_id: string
          created_at?: string
          error?: string | null
          id?: string
          resolved_at?: string | null
          result?: Json | null
          status?: string
          tool: string
        }
        Update: {
          arguments?: Json
          confirmed_by?: string | null
          conversation_id?: string
          created_at?: string
          error?: string | null
          id?: string
          resolved_at?: string | null
          result?: Json | null
          status?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_tool_calls_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_tool_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_usage: {
        Row: {
          day: string
          input_tokens: number
          messages: number
          organization_id: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          day?: string
          input_tokens?: number
          messages?: number
          organization_id: string
          output_tokens?: number
          user_id: string
        }
        Update: {
          day?: string
          input_tokens?: number
          messages?: number
          organization_id?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_counters: {
        Row: {
          organization_id: string
          seq: number
          updated_at: string
          year: number
        }
        Insert: {
          organization_id: string
          seq?: number
          updated_at?: string
          year: number
        }
        Update: {
          organization_id?: string
          seq?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          created_at: string
          id: string
          issued_at: string
          number: string
          order_id: string
          organization_id: string
          pdf_path: string | null
          traceability_snapshot: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_at?: string
          number: string
          order_id: string
          organization_id: string
          pdf_path?: string | null
          traceability_snapshot?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_at?: string
          number?: string
          order_id?: string
          organization_id?: string
          pdf_path?: string | null
          traceability_snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_addresses: {
        Row: {
          address: string
          archived_at: string | null
          client_id: string
          county: string | null
          county_code: string | null
          created_at: string
          geocoded_at: string | null
          id: string
          is_default: boolean
          label: string | null
          lat: number | null
          lng: number | null
          locality: string | null
          organization_id: string
          postal_code: string | null
          street: string | null
          street_number: string | null
          updated_at: string
        }
        Insert: {
          address: string
          archived_at?: string | null
          client_id: string
          county?: string | null
          county_code?: string | null
          created_at?: string
          geocoded_at?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          lng?: number | null
          locality?: string | null
          organization_id: string
          postal_code?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          archived_at?: string | null
          client_id?: string
          county?: string | null
          county_code?: string | null
          created_at?: string
          geocoded_at?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          lng?: number | null
          locality?: string | null
          organization_id?: string
          postal_code?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at?: string | null
          archived_by: string | null
          contact_person: string | null
          created_at: string
          cui: string
          email: string | null
          hq_address: string | null
          id: string
          is_supplier: boolean
          is_vat_payer: boolean
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          reg_com: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          contact_person?: string | null
          created_at?: string
          cui: string
          email?: string | null
          hq_address?: string | null
          id?: string
          is_supplier?: boolean
          is_vat_payer?: boolean
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          reg_com?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          contact_person?: string | null
          created_at?: string
          cui?: string
          email?: string | null
          hq_address?: string | null
          id?: string
          is_supplier?: boolean
          is_vat_payer?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          reg_com?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          carrier_name: string
          created_at: string
          created_by: string | null
          declaration_error: string | null
          declaration_status: Database["public"]["Enums"]["delivery_declaration_status"]
          driver_name: string
          id: string
          order_id: string
          organization_id: string
          origin_site_id: string | null
          receipt_notes: string | null
          received_at: string | null
          received_by_name: string | null
          received_via_portal: boolean
          route_alternatives: Json | null
          route_computed_at: string | null
          route_destination: string
          route_distance_m: number | null
          route_duration_s: number | null
          route_origin: string
          route_polyline: string | null
          route_selected_index: number | null
          route_selection:
            | Database["public"]["Enums"]["route_selection_mode"]
            | null
          scheduled_date: string
          uit_code: string | null
          updated_at: string
          vehicle_plate: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          carrier_name: string
          created_at?: string
          created_by?: string | null
          declaration_error?: string | null
          declaration_status?: Database["public"]["Enums"]["delivery_declaration_status"]
          driver_name: string
          id?: string
          order_id: string
          organization_id: string
          origin_site_id?: string | null
          receipt_notes?: string | null
          received_at?: string | null
          received_by_name?: string | null
          received_via_portal?: boolean
          route_alternatives?: Json | null
          route_computed_at?: string | null
          route_destination: string
          route_distance_m?: number | null
          route_duration_s?: number | null
          route_origin: string
          route_polyline?: string | null
          route_selected_index?: number | null
          route_selection?:
            | Database["public"]["Enums"]["route_selection_mode"]
            | null
          scheduled_date: string
          uit_code?: string | null
          updated_at?: string
          vehicle_plate: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          carrier_name?: string
          created_at?: string
          created_by?: string | null
          declaration_error?: string | null
          declaration_status?: Database["public"]["Enums"]["delivery_declaration_status"]
          driver_name?: string
          id?: string
          order_id?: string
          organization_id?: string
          origin_site_id?: string | null
          receipt_notes?: string | null
          received_at?: string | null
          received_by_name?: string | null
          received_via_portal?: boolean
          route_alternatives?: Json | null
          route_computed_at?: string | null
          route_destination?: string
          route_distance_m?: number | null
          route_duration_s?: number | null
          route_origin?: string
          route_polyline?: string | null
          route_selected_index?: number | null
          route_selection?:
            | Database["public"]["Enums"]["route_selection_mode"]
            | null
          scheduled_date?: string
          uit_code?: string | null
          updated_at?: string
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_origin_site_id_fkey"
            columns: ["origin_site_id"]
            isOneToOne: false
            referencedRelation: "organization_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          organization_id: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["document_owner_type"]
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          organization_id: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["document_owner_type"]
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          organization_id?: string
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["document_owner_type"]
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_tracked: boolean
          kind: Database["public"]["Enums"]["item_kind"]
          organization_id: string
          sellable: boolean
          title: string
          unit: Database["public"]["Enums"]["unit_of_measure"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_tracked?: boolean
          kind?: Database["public"]["Enums"]["item_kind"]
          organization_id: string
          sellable?: boolean
          title: string
          unit: Database["public"]["Enums"]["unit_of_measure"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_tracked?: boolean
          kind?: Database["public"]["Enums"]["item_kind"]
          organization_id?: string
          sellable?: boolean
          title?: string
          unit?: Database["public"]["Enums"]["unit_of_measure"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_counters: {
        Row: {
          organization_id: string
          seq: number
          updated_at: string
          year: number
        }
        Insert: {
          organization_id: string
          seq?: number
          updated_at?: string
          year: number
        }
        Update: {
          organization_id?: string
          seq?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "lot_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          block_reason: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string | null
          created_at: string
          entry_date: string
          id: string
          initial_qty: number
          is_blocked: boolean
          item_id: string
          location: string | null
          lot_code: string
          organization_id: string
          provenance: Database["public"]["Enums"]["lot_provenance"]
          quality_status: Database["public"]["Enums"]["quality_status"]
          remaining_qty: number
          source: string | null
          updated_at: string
        }
        Insert: {
          block_reason?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          initial_qty: number
          is_blocked?: boolean
          item_id: string
          location?: string | null
          lot_code: string
          organization_id: string
          provenance: Database["public"]["Enums"]["lot_provenance"]
          quality_status?: Database["public"]["Enums"]["quality_status"]
          remaining_qty: number
          source?: string | null
          updated_at?: string
        }
        Update: {
          block_reason?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          initial_qty?: number
          is_blocked?: boolean
          item_id?: string
          location?: string | null
          lot_code?: string
          organization_id?: string
          provenance?: Database["public"]["Enums"]["lot_provenance"]
          quality_status?: Database["public"]["Enums"]["quality_status"]
          remaining_qty?: number
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          error: string | null
          id: string
          organization_id: string
          recipient_email: string
          related_order_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          id?: string
          organization_id: string
          recipient_email: string
          related_order_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          id?: string
          organization_id?: string
          recipient_email?: string
          related_order_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_counters: {
        Row: {
          organization_id: string
          seq: number
          updated_at: string
          year: number
        }
        Insert: {
          organization_id: string
          seq?: number
          updated_at?: string
          year: number
        }
        Update: {
          organization_id?: string
          seq?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          order_id: string
          organization_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          order_id: string
          organization_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          order_id?: string
          organization_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_links: {
        Row: {
          created_at: string
          id: string
          link_type: Database["public"]["Enums"]["order_link_type"]
          linked_order_id: string
          organization_id: string
          original_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_type: Database["public"]["Enums"]["order_link_type"]
          linked_order_id: string
          organization_id: string
          original_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: Database["public"]["Enums"]["order_link_type"]
          linked_order_id?: string
          organization_id?: string
          original_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_links_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_links_original_order_id_fkey"
            columns: ["original_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          created_by_admin: boolean
          deleted_at: string | null
          deleted_by: string | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_date: string | null
          expected_return_date: string | null
          id: string
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_admin?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_date?: string | null
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          organization_id: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_admin?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_date?: string | null
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          organization_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "client_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_sites: {
        Row: {
          address: string
          county: string | null
          county_code: string | null
          created_at: string
          geocoded_at: string | null
          id: string
          is_default: boolean
          lat: number | null
          lng: number | null
          locality: string | null
          name: string
          organization_id: string
          postal_code: string | null
          street: string | null
          street_number: string | null
          updated_at: string
        }
        Insert: {
          address: string
          county?: string | null
          county_code?: string | null
          created_at?: string
          geocoded_at?: string | null
          id?: string
          is_default?: boolean
          lat?: number | null
          lng?: number | null
          locality?: string | null
          name: string
          organization_id: string
          postal_code?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          county?: string | null
          county_code?: string | null
          created_at?: string
          geocoded_at?: string | null
          id?: string
          is_default?: boolean
          lat?: number | null
          lng?: number | null
          locality?: string | null
          name?: string
          organization_id?: string
          postal_code?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          ai_daily_user_message_limit: number
          ai_enabled: boolean
          ai_monthly_message_limit: number
          created_at: string
          cui: string | null
          custom_domain: string | null
          email_from_address: string | null
          email_from_name: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          reg_com: string | null
          secondary_color: string | null
          slug: string
          status: Database["public"]["Enums"]["org_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          ai_daily_user_message_limit?: number
          ai_enabled?: boolean
          ai_monthly_message_limit?: number
          created_at?: string
          cui?: string | null
          custom_domain?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          reg_com?: string | null
          secondary_color?: string | null
          slug: string
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          ai_daily_user_message_limit?: number
          ai_enabled?: boolean
          ai_monthly_message_limit?: number
          created_at?: string
          cui?: string | null
          custom_domain?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          reg_com?: string | null
          secondary_color?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Relationships: []
      }
      process_inputs: {
        Row: {
          created_at: string
          id: string
          item_id: string
          lot_id: string
          organization_id: string
          process_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          lot_id: string
          organization_id: string
          process_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          lot_id?: string
          organization_id?: string
          process_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_inputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_inputs_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_inputs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_inputs_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_outputs: {
        Row: {
          created_at: string
          id: string
          item_id: string
          lot_id: string
          organization_id: string
          process_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          lot_id: string
          organization_id: string
          process_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          lot_id?: string
          organization_id?: string
          process_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_outputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_outputs_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_outputs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_outputs_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          output_item_id: string | null
          recipe_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["process_status"]
          type: Database["public"]["Enums"]["process_type"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          output_item_id?: string | null
          recipe_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          type: Database["public"]["Enums"]["process_type"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          output_item_id?: string | null
          recipe_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          type?: Database["public"]["Enums"]["process_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_output_item_id_fkey"
            columns: ["output_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["org_status"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_components: {
        Row: {
          component_item_id: string
          conversion_factor: number
          created_at: string
          id: string
          organization_id: string
          percentage: number
          recipe_id: string
          updated_at: string
        }
        Insert: {
          component_item_id: string
          conversion_factor?: number
          created_at?: string
          id?: string
          organization_id: string
          percentage: number
          recipe_id: string
          updated_at?: string
        }
        Update: {
          component_item_id?: string
          conversion_factor?: number
          created_at?: string
          id?: string
          organization_id?: string
          percentage?: number
          recipe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_components_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_components_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_components_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          direction: Database["public"]["Enums"]["recipe_direction"]
          id: string
          item_id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["recipe_direction"]
          id?: string
          item_id: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["recipe_direction"]
          id?: string
          item_id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: Database["public"]["Enums"]["stock_event_type"]
          id: string
          item_id: string
          lot_id: string | null
          order_id: string | null
          organization_id: string
          process_id: string | null
          quantity: number
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: Database["public"]["Enums"]["stock_event_type"]
          id?: string
          item_id: string
          lot_id?: string | null
          order_id?: string | null
          organization_id: string
          process_id?: string | null
          quantity: number
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["stock_event_type"]
          id?: string
          item_id?: string
          lot_id?: string | null
          order_id?: string | null
          organization_id?: string
          process_id?: string | null
          quantity?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_events_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_intake_order: {
        Args: { p_order_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          created_by_admin: boolean
          deleted_at: string | null
          deleted_by: string | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_date: string | null
          expected_return_date: string | null
          id: string
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_order: {
        Args: { p_order_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          created_by_admin: boolean
          deleted_at: string | null
          deleted_by: string | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_date: string | null
          expected_return_date: string | null
          id: string
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_return_order: {
        Args: { p_return_order_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          created_by_admin: boolean
          deleted_at: string | null
          deleted_by: string | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_date: string | null
          expected_return_date: string | null
          id: string
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assistant_track_usage: {
        Args: {
          p_input_tokens?: number
          p_messages?: number
          p_output_tokens?: number
        }
        Returns: undefined
      }
      cancel_delivery: {
        Args: { p_delivery_id: string; p_reason: string }
        Returns: undefined
      }
      cancel_lot: {
        Args: { p_lot_id: string; p_reason: string }
        Returns: {
          block_reason: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string | null
          created_at: string
          entry_date: string
          id: string
          initial_qty: number
          is_blocked: boolean
          item_id: string
          location: string | null
          lot_code: string
          organization_id: string
          provenance: Database["public"]["Enums"]["lot_provenance"]
          quality_status: Database["public"]["Enums"]["quality_status"]
          remaining_qty: number
          source: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_order: {
        Args: { p_order_id: string }
        Returns: {
          accepted_at: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          created_by_admin: boolean
          deleted_at: string | null
          deleted_by: string | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_date: string | null
          expected_return_date: string | null
          id: string
          notes: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_process: {
        Args: { p_process_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          output_item_id: string | null
          recipe_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["process_status"]
          type: Database["public"]["Enums"]["process_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "processes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      client_confirm_delivery_receipt: {
        Args: { p_notes?: string; p_order_id: string; p_received_by_name: string }
        Returns: undefined
      }
      client_order_delivery: {
        Args: { p_order_id: string }
        Returns: {
          carrier_name: string
          driver_name: string
          received_at: string | null
          received_by_name: string | null
          route_destination: string
          scheduled_date: string
          uit_code: string | null
          vehicle_plate: string
        }[]
      }
      confirm_process: {
        Args: {
          p_inputs?: Json
          p_notes?: string
          p_output_item_id: string
          p_outputs?: Json
          p_recipe_id?: string
          p_type: Database["public"]["Enums"]["process_type"]
        }
        Returns: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          output_item_id: string | null
          recipe_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["process_status"]
          type: Database["public"]["Enums"]["process_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "processes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_fifo: {
        Args: {
          p_event_type?: Database["public"]["Enums"]["stock_event_type"]
          p_item_id: string
          p_manual_lot_ids?: string[]
          p_order_id?: string
          p_process_id?: string
          p_qty: number
          p_reason?: string
        }
        Returns: {
          lot_id: string
          qty: number
        }[]
      }
      create_lot: {
        Args: {
          p_client_id?: string
          p_entry_date?: string
          p_item_id: string
          p_location?: string
          p_provenance: Database["public"]["Enums"]["lot_provenance"]
          p_quality_status?: Database["public"]["Enums"]["quality_status"]
          p_quantity: number
          p_reason?: string
          p_source?: string
        }
        Returns: {
          block_reason: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string | null
          created_at: string
          entry_date: string
          id: string
          initial_qty: number
          is_blocked: boolean
          item_id: string
          location: string | null
          lot_code: string
          organization_id: string
          provenance: Database["public"]["Enums"]["lot_provenance"]
          quality_status: Database["public"]["Enums"]["quality_status"]
          remaining_qty: number
          source: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_draft_order: { Args: { p_order_id: string }; Returns: undefined }
      generate_certificate_number: { Args: { p_org: string }; Returns: string }
      generate_lot_code: { Args: { p_org: string }; Returns: string }
      generate_order_number: { Args: { p_org: string }; Returns: string }
      org_branding: {
        Args: { p_domain?: string; p_slug?: string }
        Returns: {
          custom_domain: string
          id: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          slug: string
        }[]
      }
      set_lot_block: {
        Args: { p_blocked: boolean; p_lot_id: string; p_reason?: string }
        Returns: {
          block_reason: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string | null
          created_at: string
          entry_date: string
          id: string
          initial_qty: number
          is_blocked: boolean
          item_id: string
          location: string | null
          lot_code: string
          organization_id: string
          provenance: Database["public"]["Enums"]["lot_provenance"]
          quality_status: Database["public"]["Enums"]["quality_status"]
          remaining_qty: number
          source: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      delivery_declaration_status: "not_declared" | "declared" | "failed"
      document_owner_type: "client" | "order" | "item"
      item_kind: "physical" | "service"
      lot_provenance:
        | "purchase"
        | "internal_production"
        | "recycling"
        | "return"
        | "inventory_adjustment"
        | "reconditioning"
        | "aport_client"
      notification_status: "queued" | "sent" | "failed"
      notification_type:
        | "order_sent"
        | "order_accepted"
        | "order_delivered"
        | "order_closed"
        | "order_cancelled"
        | "staff_invite"
      order_link_type: "return" | "warranty" | "replacement"
      order_status:
        | "draft"
        | "sent"
        | "accepted"
        | "delivered"
        | "closed"
        | "cancelled"
      order_type: "material" | "serviciu" | "aport"
      org_status: "active" | "suspended"
      process_status:
        | "planned"
        | "in_progress"
        | "awaiting_confirmation"
        | "completed"
        | "cancelled"
      process_type: "output_fixed" | "input_fixed"
      quality_status: "unchecked" | "passed" | "failed"
      recipe_direction: "compunere" | "descompunere"
      route_selection_mode: "auto" | "manual"
      stock_event_type:
        | "intake"
        | "consumption"
        | "adjustment"
        | "block"
        | "unblock"
        | "reversal"
      unit_of_measure:
        | "kg"
        | "tona"
        | "mc"
        | "litru"
        | "bucata"
        | "sac"
        | "palet"
      user_role: "super_admin" | "admin" | "operator" | "client"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      delivery_declaration_status: ["not_declared", "declared", "failed"],
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
      notification_status: ["queued", "sent", "failed"],
      notification_type: [
        "order_sent",
        "order_accepted",
        "order_delivered",
        "order_closed",
        "order_cancelled",
        "staff_invite",
      ],
      order_link_type: ["return", "warranty", "replacement"],
      order_status: [
        "draft",
        "sent",
        "accepted",
        "delivered",
        "closed",
        "cancelled",
      ],
      org_status: ["active", "suspended"],
      process_status: [
        "planned",
        "in_progress",
        "awaiting_confirmation",
        "completed",
        "cancelled",
      ],
      process_type: ["output_fixed", "input_fixed"],
      quality_status: ["unchecked", "passed", "failed"],
      route_selection_mode: ["auto", "manual"],
      stock_event_type: [
        "intake",
        "consumption",
        "adjustment",
        "block",
        "unblock",
        "reversal",
      ],
      unit_of_measure: ["kg", "tona", "mc", "litru", "bucata", "sac", "palet"],
      user_role: ["super_admin", "admin", "operator", "client"],
    },
  },
} as const

