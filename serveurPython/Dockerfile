FROM python:3.10-slim

ENV http_proxy="http://cache.univ-pau.fr:3128"
ENV https_proxy="http://cache.univ-pau.fr:3128"
ENV HTTP_PROXY="http://cache.univ-pau.fr:3128"
ENV HTTPS_PROXY="http://cache.univ-pau.fr:3128"

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update && apt-get install -y clang llvm && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . . 
EXPOSE 5000

CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]