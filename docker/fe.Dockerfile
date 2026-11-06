# Local development only: the Vite dev server with hot reload (source is mounted by compose; the
# build context is fe/, see docker-compose.yml). In
# production the FE is built by the GitHub workflow and served by Azure Static Web Apps.
FROM node:24-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
