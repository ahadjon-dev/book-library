# --- Build Stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Production Stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Store template; envsubst fills $PORT at container start
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
# envsubst replaces ${PORT:-80} then starts nginx
CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
