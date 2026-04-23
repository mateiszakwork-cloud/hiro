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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      awards: {
        Row: {
          award_name: string
          created_at: string
          description: string | null
          id: string
          issuing_organization: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          award_name: string
          created_at?: string
          description?: string | null
          id?: string
          issuing_organization?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          award_name?: string
          created_at?: string
          description?: string | null
          id?: string
          issuing_organization?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          category: string | null
          connection_note_draft: string | null
          created_at: string
          current_company: string | null
          current_title: string | null
          headline: string | null
          id: string
          inmail_draft: string | null
          inmail_subject_draft: string | null
          is_alumni: boolean
          job_id: string
          linkedin_url: string | null
          name: string | null
          outreach_status: string
          priority_score: number | null
          profile_picture_url: string | null
          shared_connections_count: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          connection_note_draft?: string | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          headline?: string | null
          id?: string
          inmail_draft?: string | null
          inmail_subject_draft?: string | null
          is_alumni?: boolean
          job_id: string
          linkedin_url?: string | null
          name?: string | null
          outreach_status?: string
          priority_score?: number | null
          profile_picture_url?: string | null
          shared_connections_count?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          connection_note_draft?: string | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          headline?: string | null
          id?: string
          inmail_draft?: string | null
          inmail_subject_draft?: string | null
          is_alumni?: boolean
          job_id?: string
          linkedin_url?: string | null
          name?: string | null
          outreach_status?: string
          priority_score?: number | null
          profile_picture_url?: string | null
          shared_connections_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_output_history: {
        Row: {
          created_at: string
          cv_output_id: string
          id: string
          job_id: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          cv_output_id: string
          id?: string
          job_id: string
          snapshot?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          cv_output_id?: string
          id?: string
          job_id?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_output_history_cv_output_id_fkey"
            columns: ["cv_output_id"]
            isOneToOne: false
            referencedRelation: "cv_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_output_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_outputs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          profile_headline: string | null
          selected_awards: Json | null
          selected_bullets: Json | null
          selected_education: Json | null
          selected_experiences: Json | null
          selected_hard_skills: Json | null
          selected_languages: Json | null
          selected_soft_skills: string[] | null
          selected_volunteering: Json | null
          tailored_summary: string | null
          tailoring_notes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          profile_headline?: string | null
          selected_awards?: Json | null
          selected_bullets?: Json | null
          selected_education?: Json | null
          selected_experiences?: Json | null
          selected_hard_skills?: Json | null
          selected_languages?: Json | null
          selected_soft_skills?: string[] | null
          selected_volunteering?: Json | null
          tailored_summary?: string | null
          tailoring_notes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          profile_headline?: string | null
          selected_awards?: Json | null
          selected_bullets?: Json | null
          selected_education?: Json | null
          selected_experiences?: Json | null
          selected_hard_skills?: Json | null
          selected_languages?: Json | null
          selected_soft_skills?: string[] | null
          selected_volunteering?: Json | null
          tailored_summary?: string | null
          tailoring_notes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_outputs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      education: {
        Row: {
          activities: string | null
          created_at: string
          degree: string
          description: string | null
          end_year: number | null
          field_of_study: string
          grade: string | null
          id: string
          institution: string
          is_expected: boolean
          start_year: number
          user_id: string
        }
        Insert: {
          activities?: string | null
          created_at?: string
          degree: string
          description?: string | null
          end_year?: number | null
          field_of_study: string
          grade?: string | null
          id?: string
          institution: string
          is_expected?: boolean
          start_year: number
          user_id: string
        }
        Update: {
          activities?: string | null
          created_at?: string
          degree?: string
          description?: string | null
          end_year?: number | null
          field_of_study?: string
          grade?: string | null
          id?: string
          institution?: string
          is_expected?: boolean
          start_year?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interests: {
        Row: {
          created_at: string
          id: string
          interests: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interests?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interests?: string[]
          user_id?: string
        }
        Relationships: []
      }
      interview_prep: {
        Row: {
          company_overview: string | null
          created_at: string
          id: string
          interview_questions: Json | null
          job_id: string
          preparation_gaps: Json | null
          role_intelligence: string | null
          updated_at: string
          user_id: string
          your_pitch: Json | null
        }
        Insert: {
          company_overview?: string | null
          created_at?: string
          id?: string
          interview_questions?: Json | null
          job_id: string
          preparation_gaps?: Json | null
          role_intelligence?: string | null
          updated_at?: string
          user_id: string
          your_pitch?: Json | null
        }
        Update: {
          company_overview?: string | null
          created_at?: string
          id?: string
          interview_questions?: Json | null
          job_id?: string
          preparation_gaps?: Json | null
          role_intelligence?: string | null
          updated_at?: string
          user_id?: string
          your_pitch?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_prep_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          application_deadline: string | null
          applied_date: string | null
          company_name: string | null
          created_at: string
          duration: string | null
          function: string | null
          hard_skills: string[] | null
          id: string
          interview_user_data: Json | null
          job_title: string | null
          languages_nice_to_have: string[] | null
          languages_required: string[] | null
          location: string | null
          match_details: Json | null
          match_score: number | null
          notes: string | null
          priority: string
          skills_nice_to_have: string[] | null
          soft_skills: string[] | null
          status: string
          url: string | null
          user_id: string
          work_mode: string | null
        }
        Insert: {
          application_deadline?: string | null
          applied_date?: string | null
          company_name?: string | null
          created_at?: string
          duration?: string | null
          function?: string | null
          hard_skills?: string[] | null
          id?: string
          interview_user_data?: Json | null
          job_title?: string | null
          languages_nice_to_have?: string[] | null
          languages_required?: string[] | null
          location?: string | null
          match_details?: Json | null
          match_score?: number | null
          notes?: string | null
          priority?: string
          skills_nice_to_have?: string[] | null
          soft_skills?: string[] | null
          status?: string
          url?: string | null
          user_id: string
          work_mode?: string | null
        }
        Update: {
          application_deadline?: string | null
          applied_date?: string | null
          company_name?: string | null
          created_at?: string
          duration?: string | null
          function?: string | null
          hard_skills?: string[] | null
          id?: string
          interview_user_data?: Json | null
          job_title?: string | null
          languages_nice_to_have?: string[] | null
          languages_required?: string[] | null
          location?: string | null
          match_details?: Json | null
          match_score?: number | null
          notes?: string | null
          priority?: string
          skills_nice_to_have?: string[] | null
          soft_skills?: string[] | null
          status?: string
          url?: string | null
          user_id?: string
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          created_at: string
          id: string
          language_name: string
          proficiency: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language_name: string
          proficiency: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language_name?: string
          proficiency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "languages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          base_cv_text: string | null
          base_cv_uploaded_at: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          linkedin_cookie: string | null
          linkedin_jsessionid: string | null
          linkedin_updated_at: string | null
          onboarding_complete: boolean
          tour_complete: boolean
        }
        Insert: {
          base_cv_text?: string | null
          base_cv_uploaded_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          linkedin_cookie?: string | null
          linkedin_jsessionid?: string | null
          linkedin_updated_at?: string | null
          onboarding_complete?: boolean
          tour_complete?: boolean
        }
        Update: {
          base_cv_text?: string | null
          base_cv_uploaded_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          linkedin_cookie?: string | null
          linkedin_jsessionid?: string | null
          linkedin_updated_at?: string | null
          onboarding_complete?: boolean
          tour_complete?: boolean
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string
          hard_skills: string[]
          id: string
          soft_skills: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          hard_skills?: string[]
          id?: string
          soft_skills?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          hard_skills?: string[]
          id?: string
          soft_skills?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteering: {
        Row: {
          created_at: string
          description: string | null
          end_year: number | null
          id: string
          is_ongoing: boolean
          organization: string
          role: string | null
          start_year: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_ongoing?: boolean
          organization: string
          role?: string | null
          start_year?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_ongoing?: boolean
          organization?: string
          role?: string | null
          start_year?: number | null
          user_id?: string
        }
        Relationships: []
      }
      work_experiences: {
        Row: {
          bullet_points: string[]
          company_name: string
          created_at: string
          end_month: number | null
          end_year: number | null
          id: string
          is_current: boolean
          job_title: string
          location: string | null
          start_month: number
          start_year: number
          user_id: string
        }
        Insert: {
          bullet_points?: string[]
          company_name: string
          created_at?: string
          end_month?: number | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          job_title: string
          location?: string | null
          start_month: number
          start_year: number
          user_id: string
        }
        Update: {
          bullet_points?: string[]
          company_name?: string
          created_at?: string
          end_month?: number | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          job_title?: string
          location?: string | null
          start_month?: number
          start_year?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_experiences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
