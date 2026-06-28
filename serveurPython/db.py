import psycopg2
import os

def get_connection():
    return psycopg2.connect(
        dbname=os.environ.get("DB_NAME"),
        user=os.environ.get("DB_USER"),
        password=os.environ.get("DB_PASSWORD"),
        host="db",
        port=os.environ.get("DB_PORT")
    )

def insert_prompt(perf_ia: dict, modele_id: int, status : bool):

    requete = """
        INSERT INTO prompt (
            done,
            number_of_generated_tokens,
            number_of_used_tokens,
            total_duration,
            load_duration,
            prompt_eval_duration,
            token_generation_duration,  
            avg_gpu_util_pct,
            avg_mem_util_pct,
            peak_gpu_util_pct,
            avg_power_w,
            peak_power_w,
            energy_joules,
            modele_id,
            status
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """

    gpu = perf_ia.get("gpu") or {}
    valeurs = (
        perf_ia.get("done"),
        perf_ia.get("tokens_generated"),
        perf_ia.get("tokens_used"),
        perf_ia.get("total_duration_ms"),
        perf_ia.get("load_duration_ms"),
        perf_ia.get("prompt_eval_duration_ms"),
        perf_ia.get("token_generation_duration_ms"),
        gpu.get("avg_gpu_util_pct"),
        gpu.get("avg_mem_util_pct"),
        gpu.get("peak_gpu_util_pct"),
        gpu.get("avg_power_w"),
        gpu.get("peak_power_w"),
        gpu.get("energy_joules"),
        modele_id,
        status
    )

    conn = get_connection()
    try:
        with conn: # commit automatique, rollback si exception
            with conn.cursor() as cur:
                cur.execute(requete, valeurs)
    finally:
        conn.close()