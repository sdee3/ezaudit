FROM public.ecr.aws/lambda/nodejs:22

WORKDIR ${LAMBDA_TASK_ROOT}
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN dnf install -y tar && dnf clean all
RUN mkdir -p /opt/chromium && \
    curl -fsSL https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.arm64.tar | \
    tar -xf - -C /opt/chromium
COPY index.mjs egress-proxy.mjs proof.mjs ./

CMD ["index.handler"]
