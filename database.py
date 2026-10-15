import mysql.connector
from config import DB_CONFIG

def get_connection():
    return mysql.connector.connect(**DB_CONFIG)

def save_message(session_id, sender, message):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            query = "INSERT INTO chat_history (session_id, sender, message) VALUES (%s, %s, %s)"
            cursor.execute(query, (session_id, sender, message))
        conn.commit()
    finally:
        conn.close()

def get_history(session_id, limit=20):
    conn = get_connection()
    try:
        with conn.cursor(dictionary=True) as cursor:
            query = (
                "SELECT sender, message, created_at FROM chat_history "
                "WHERE session_id = %s ORDER BY created_at DESC, id DESC LIMIT %s"
            )
            cursor.execute(query, (session_id, limit))
            results = cursor.fetchall()
        return list(reversed(results))
    finally:
        conn.close()