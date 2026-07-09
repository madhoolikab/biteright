.PHONY: dev frontend backend eval install install-frontend install-backend

# Run frontend + backend together (Ctrl+C stops both)
dev:
	@trap 'kill 0' EXIT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

frontend:
	cd frontend && npm run dev

backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload

eval:
	uvicorn eval.server:app --port 8100 --reload

install: install-frontend install-backend

install-frontend:
	cd frontend && npm install

install-backend:
	cd backend && . .venv/bin/activate && pip install -r requirements.txt
