FROM python:3.12-slim
RUN pip install --no-cache-dir google-auth==2.40.3 requests==2.32.4
COPY refresh.py /usr/local/bin/refresh.py
ENTRYPOINT ["python", "/usr/local/bin/refresh.py"]
