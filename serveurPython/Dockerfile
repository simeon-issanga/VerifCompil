FROM python:3.10-slim-bookworm 



ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app


RUN apt-get update && apt-get install -y clang llvm && apt-get install -y linux-perf
#&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . . 
EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
#CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]