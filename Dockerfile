FROM node:22-alpine AS builder

# Install dependencies for canvas
RUN apk add --no-cache build-base g++ cairo-dev jpeg-dev pango-dev giflib-dev librsvg-dev python3

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine

# Install runtime dependencies for canvas
RUN apk add --no-cache cairo pango jpeg giflib librsvg

WORKDIR /app

COPY package*.json ./
# Since we need to build canvas for production, we also need build tools here, 
# or we can just copy node_modules from builder. To save space, let's copy from builder.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

CMD ["npm", "start"]
