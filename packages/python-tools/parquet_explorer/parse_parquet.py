import duckdb

con = duckdb.connect()

print(
    con.execute("""
    DESCRIBE SELECT * FROM read_parquet('my_file.parquet')
    """).fetchdf()
)