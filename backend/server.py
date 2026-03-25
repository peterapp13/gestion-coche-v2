from fastapi import FastAPI, HTTPException, Header, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid
import httpx
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "vehicle_management")]

# Collections
users_collection = db.users
sessions_collection = db.user_sessions
repostajes_collection = db.repostajes
almacen_collection = db.almacen
taller_collection = db.taller

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class SessionCreate(BaseModel):
    session_id: str

class Repostaje(BaseModel):
    repostaje_id: Optional[str] = None
    user_id: str
    numero_factura: str
    gasolinera: str
    fecha: str
    km_actuales: float
    autonomia_antes: float
    autonomia_despues: float
    litros: float
    precio_litro: float
    total_euros: float
    km_gastados: Optional[float] = None
    consumo_l100km: Optional[float] = None
    created_at: Optional[datetime] = None

class RepostajeCreate(BaseModel):
    numero_factura: str
    gasolinera: str
    fecha: str
    km_actuales: float
    autonomia_antes: float
    autonomia_despues: float
    litros: float
    precio_litro: float
    total_euros: float

class Almacen(BaseModel):
    almacen_id: Optional[str] = None
    user_id: str
    fecha_compra: str
    recambio: str
    marca: str
    coste_euros: float
    estado: str = "Pendiente"  # Pendiente or Instalado
    created_at: Optional[datetime] = None

class AlmacenCreate(BaseModel):
    fecha_compra: str
    recambio: str
    marca: str
    coste_euros: float
    estado: str = "Pendiente"

class Taller(BaseModel):
    taller_id: Optional[str] = None
    user_id: str
    fecha_montaje: str
    km_montaje: float
    recambio_instalado: str
    almacen_id: Optional[str] = None  # Link to almacen if selected from storage
    notas: Optional[str] = None
    created_at: Optional[datetime] = None

class TallerCreate(BaseModel):
    fecha_montaje: str
    km_montaje: float
    recambio_instalado: str
    almacen_id: Optional[str] = None
    notas: Optional[str] = None

# ==================== AUTH HELPER ====================

async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> User:
    """Get current user from session_token (cookie or header)"""
    session_token = None
    
    # Check cookie first
    if "session_token" in request.cookies:
        session_token = request.cookies["session_token"]
    # Fallback to Authorization header
    elif authorization and authorization.startswith("Bearer "):
        session_token = authorization.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await sessions_collection.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await sessions_collection.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await users_collection.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)

# ==================== AUTH ENDPOINTS ====================

@app.post("/api/auth/session")
async def create_session(session_data: SessionCreate, response: Response):
    """Exchange session_id for session_token"""
    try:
        # Call Emergent Auth API
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_data.session_id},
                timeout=10.0
            )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        auth_data = auth_response.json()
        
        # Create or update user
        user_id = None
        existing_user = await users_collection.find_one(
            {"email": auth_data["email"]},
            {"_id": 0}
        )
        
        if existing_user:
            user_id = existing_user["user_id"]
            # Update user info
            await users_collection.update_one(
                {"user_id": user_id},
                {"$set": {
                    "name": auth_data["name"],
                    "picture": auth_data.get("picture")
                }}
            )
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await users_collection.insert_one({
                "user_id": user_id,
                "email": auth_data["email"],
                "name": auth_data["name"],
                "picture": auth_data.get("picture"),
                "created_at": datetime.now(timezone.utc)
            })
        
        # Store session
        session_token = auth_data["session_token"]
        await sessions_collection.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc)
        })
        
        # Set httpOnly cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60
        )
        
        return {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data["name"],
            "picture": auth_data.get("picture")
        }
    
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Auth service timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/me")
async def get_me(request: Request, authorization: Optional[str] = Header(None)):
    """Get current user info"""
    user = await get_current_user(request, authorization)
    return user.model_dump()

@app.post("/api/auth/logout")
async def logout(request: Request, response: Response, authorization: Optional[str] = Header(None)):
    """Logout user"""
    session_token = None
    
    if "session_token" in request.cookies:
        session_token = request.cookies["session_token"]
    elif authorization and authorization.startswith("Bearer "):
        session_token = authorization.replace("Bearer ", "")
    
    if session_token:
        await sessions_collection.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== REPOSTAJES ENDPOINTS ====================

@app.get("/api/repostajes")
async def get_repostajes(request: Request, authorization: Optional[str] = Header(None)):
    """Get all fuel records for current user"""
    user = await get_current_user(request, authorization)
    
    records = await repostajes_collection.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("km_actuales", -1).to_list(1000)
    
    return records

@app.post("/api/repostajes")
async def create_repostaje(data: RepostajeCreate, request: Request, authorization: Optional[str] = Header(None)):
    """Create new fuel record with auto-calculations"""
    user = await get_current_user(request, authorization)
    
    # Get previous record to calculate KM Gastados
    previous_record = await repostajes_collection.find_one(
        {"user_id": user.user_id},
        {"_id": 0},
        sort=[("km_actuales", -1)]
    )
    
    km_gastados = None
    consumo_l100km = None
    
    if previous_record:
        km_gastados = data.km_actuales - previous_record["km_actuales"]
        if km_gastados > 0:
            consumo_l100km = round((data.litros / km_gastados) * 100, 2)
    
    repostaje_id = f"repo_{uuid.uuid4().hex[:12]}"
    repostaje = Repostaje(
        repostaje_id=repostaje_id,
        user_id=user.user_id,
        **data.model_dump(),
        km_gastados=km_gastados,
        consumo_l100km=consumo_l100km,
        created_at=datetime.now(timezone.utc)
    )
    
    await repostajes_collection.insert_one(repostaje.model_dump())
    return repostaje.model_dump()

@app.delete("/api/repostajes/{repostaje_id}")
async def delete_repostaje(repostaje_id: str, request: Request, authorization: Optional[str] = Header(None)):
    """Delete fuel record"""
    user = await get_current_user(request, authorization)
    
    result = await repostajes_collection.delete_one({
        "repostaje_id": repostaje_id,
        "user_id": user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"message": "Deleted successfully"}

# ==================== ALMACÉN ENDPOINTS ====================

@app.get("/api/almacen")
async def get_almacen(request: Request, authorization: Optional[str] = Header(None)):
    """Get all parts in storage"""
    user = await get_current_user(request, authorization)
    
    records = await almacen_collection.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return records

@app.post("/api/almacen")
async def create_almacen(data: AlmacenCreate, request: Request, authorization: Optional[str] = Header(None)):
    """Create new part in storage"""
    user = await get_current_user(request, authorization)
    
    almacen_id = f"alm_{uuid.uuid4().hex[:12]}"
    almacen = Almacen(
        almacen_id=almacen_id,
        user_id=user.user_id,
        **data.model_dump(),
        created_at=datetime.now(timezone.utc)
    )
    
    await almacen_collection.insert_one(almacen.model_dump())
    return almacen.model_dump()

@app.delete("/api/almacen/{almacen_id}")
async def delete_almacen(almacen_id: str, request: Request, authorization: Optional[str] = Header(None)):
    """Delete part from storage"""
    user = await get_current_user(request, authorization)
    
    result = await almacen_collection.delete_one({
        "almacen_id": almacen_id,
        "user_id": user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"message": "Deleted successfully"}

# ==================== TALLER ENDPOINTS ====================

@app.get("/api/taller")
async def get_taller(request: Request, authorization: Optional[str] = Header(None)):
    """Get all workshop records"""
    user = await get_current_user(request, authorization)
    
    records = await taller_collection.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("km_montaje", -1).to_list(1000)
    
    return records

@app.post("/api/taller")
async def create_taller(data: TallerCreate, request: Request, authorization: Optional[str] = Header(None)):
    """Create workshop record and auto-update almacen status"""
    user = await get_current_user(request, authorization)
    
    taller_id = f"tall_{uuid.uuid4().hex[:12]}"
    taller = Taller(
        taller_id=taller_id,
        user_id=user.user_id,
        **data.model_dump(),
        created_at=datetime.now(timezone.utc)
    )
    
    await taller_collection.insert_one(taller.model_dump())
    
    # Auto-update almacen status if almacen_id is provided
    if data.almacen_id:
        await almacen_collection.update_one(
            {
                "almacen_id": data.almacen_id,
                "user_id": user.user_id
            },
            {"$set": {"estado": "Instalado"}}
        )
    
    return taller.model_dump()

@app.delete("/api/taller/{taller_id}")
async def delete_taller(taller_id: str, request: Request, authorization: Optional[str] = Header(None)):
    """Delete workshop record"""
    user = await get_current_user(request, authorization)
    
    result = await taller_collection.delete_one({
        "taller_id": taller_id,
        "user_id": user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    
    return {"message": "Deleted successfully"}

# ==================== EXPORT ENDPOINT ====================

@app.get("/api/export")
async def export_data(request: Request, authorization: Optional[str] = Header(None)):
    """Export all data as CSV format"""
    user = await get_current_user(request, authorization)
    
    # Get all records
    repostajes = await repostajes_collection.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("km_actuales", 1).to_list(1000)
    
    almacen = await almacen_collection.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("fecha_compra", 1).to_list(1000)
    
    taller = await taller_collection.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("fecha_montaje", 1).to_list(1000)
    
    return {
        "repostajes": repostajes,
        "almacen": almacen,
        "taller": taller
    }

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "vehicle-management-api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
