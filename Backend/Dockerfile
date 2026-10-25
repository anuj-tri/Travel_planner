FROM python:3.10-slim

# set the working directory inside the container
WORKDIR /app

#prevent python from writing the bytecode files
ENV PYTHONDONTWRITEBYTECODE=1

#show python logs immediately
ENV PYTHONUNBUFFERED=1

#copy the dependency file first for better build caching
COPY requirements.txt .

#install python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# copy the backend application into the container
COPY . .

# FASTAPI listens on port 8000
EXPOSE 8000

#start the fastapi application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
