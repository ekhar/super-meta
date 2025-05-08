-- Create user_metrics table to track cumulative metrics
CREATE TABLE public.user_metrics (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    total_api_requests bigint DEFAULT 0,
    total_read_bytes bigint DEFAULT 0,
    total_write_bytes bigint DEFAULT 0,
    total_egress_bytes bigint DEFAULT 0,
    last_updated_at timestamptz DEFAULT now()
);

-- Create user_metrics_daily table for daily aggregates
CREATE TABLE public.user_metrics_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    api_requests bigint DEFAULT 0,
    read_bytes bigint DEFAULT 0,
    write_bytes bigint DEFAULT 0,
    egress_bytes bigint DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, date)
);

-- Create indexes for better query performance
CREATE INDEX user_metrics_daily_user_id_date_idx ON public.user_metrics_daily (user_id, date);
CREATE INDEX user_metrics_daily_date_idx ON public.user_metrics_daily (date);

-- Enable RLS
ALTER TABLE public.user_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metrics_daily ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_metrics
CREATE POLICY "Users can view their own metrics"
    ON public.user_metrics FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- RLS policies for user_metrics_daily
CREATE POLICY "Users can view their own daily metrics"
    ON public.user_metrics_daily FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Function to record API request and data metrics
CREATE OR REPLACE FUNCTION public.record_api_metrics(
    p_user_id uuid,
    p_read_bytes bigint DEFAULT 0,
    p_write_bytes bigint DEFAULT 0,
    p_egress_bytes bigint DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date date := current_date;
BEGIN
    -- Insert or update daily metrics
    INSERT INTO public.user_metrics_daily (
        user_id, date, api_requests, read_bytes, write_bytes, egress_bytes
    )
    VALUES (
        p_user_id, v_date, 1, p_read_bytes, p_write_bytes, p_egress_bytes
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        api_requests = user_metrics_daily.api_requests + 1,
        read_bytes = user_metrics_daily.read_bytes + EXCLUDED.read_bytes,
        write_bytes = user_metrics_daily.write_bytes + EXCLUDED.write_bytes,
        egress_bytes = user_metrics_daily.egress_bytes + EXCLUDED.egress_bytes;

    -- Update cumulative metrics
    INSERT INTO public.user_metrics (
        user_id, total_api_requests, total_read_bytes, total_write_bytes, total_egress_bytes, last_updated_at
    )
    VALUES (
        p_user_id, 1, p_read_bytes, p_write_bytes, p_egress_bytes, now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_api_requests = user_metrics.total_api_requests + 1,
        total_read_bytes = user_metrics.total_read_bytes + EXCLUDED.total_read_bytes,
        total_write_bytes = user_metrics.total_write_bytes + EXCLUDED.total_write_bytes,
        total_egress_bytes = user_metrics.total_egress_bytes + EXCLUDED.total_egress_bytes,
        last_updated_at = now();
END;
$$;

-- Function to get user metrics for a date range
CREATE OR REPLACE FUNCTION public.get_user_metrics(
    p_user_id uuid,
    p_start_date date,
    p_end_date date
)
RETURNS TABLE (
    date date,
    api_requests bigint,
    read_bytes bigint,
    write_bytes bigint,
    egress_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has access (is admin or owner)
    IF NOT (
        auth.uid() = p_user_id OR 
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        umd.date,
        umd.api_requests,
        umd.read_bytes,
        umd.write_bytes,
        umd.egress_bytes
    FROM public.user_metrics_daily umd
    WHERE umd.user_id = p_user_id
    AND umd.date BETWEEN p_start_date AND p_end_date
    ORDER BY umd.date;
END;
$$;

-- Create a trigger to ensure user_metrics entry exists for new users
CREATE OR REPLACE FUNCTION public.ensure_user_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_metrics (user_id)
    VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_metrics
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_user_metrics();
