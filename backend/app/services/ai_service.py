import logging
import json
from typing import Optional, Dict, Any, List
from openai import OpenAI
from app.core.config import settings
from app.core.firebase import db

logger = logging.getLogger("servalocal.ai")

class AIService:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.client = None
        if self.api_key and "your_openai" not in self.api_key:
            try:
                self.client = OpenAI(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI Client: {e}")
        else:
            logger.info("OpenAI API key missing or template. Running AI Service in Mock/Heuristic Fallback Mode.")

    def parse_search_intent(self, natural_query: str) -> Dict[str, Any]:
        """
        Parses a customer natural language prompt (e.g., 'AC is leaking water and the hall is dirty')
        into discrete category, service, and add-on selections.
        """
        if not self.client:
            # Fallback heuristic parser
            q = natural_query.lower()
            res = {
                "serviceId": "full_house_clean",
                "subServiceId": "1bhk",
                "addOns": [],
                "confidence": 0.8,
                "notes": "Parsed via fallback local keyword matcher."
            }
            if "ac" in q or "cool" in q or "conditioner" in q:
                res["serviceId"] = "ac_servicing"
                res["subServiceId"] = "jet_wash"
                if "leak" in q or "water" in q:
                    res["addOns"] = ["drain_pipe"]
            elif "tap" in q or "leak" in q or "plumb" in q or "pipe" in q:
                res["serviceId"] = "tap_repair"
                res["subServiceId"] = "gasket_replace"
            elif "switch" in q or "power" in q or "shock" in q or "fuse" in q:
                res["serviceId"] = "switchboard_fix"
                res["subServiceId"] = "switch_replace"
            return res

        try:
            prompt = f"""
            You are a helpful intent-parsing engine for ServaLocal, a home services marketplace in India.
            Standard Services include:
            - "full_house_clean" (Deep Cleaning, subServices: "1bhk", "2bhk", "3bhk")
            - "tap_repair" (Plumbing, subServices: "gasket_replace", "tap_install")
            - "ac_servicing" (AC Repair, subServices: "jet_wash", "gas_charge")
            - "switchboard_fix" (Electrical, subServices: "switch_replace", "complete_board")

            Extract the primary serviceId, recommended subServiceId, and list of addOns.
            User input: "{natural_query}"
            
            Return ONLY a valid JSON object matching this schema:
            {{
              "serviceId": str,
              "subServiceId": str,
              "addOns": list[str],
              "confidence": float
            }}
            """
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error parsing search intent with GPT-4o: {e}")
            return {"serviceId": "full_house_clean", "subServiceId": "1bhk", "addOns": [], "confidence": 0.5}

    def chat_assistant(self, message: str, chat_history: List[Dict[str, str]], user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Conversational assistant powered by GPT-4o.
        Assists customers and workers with service inquiries, booking status context, and help sheets.
        """
        user_name = user_context.get("name", "User") if user_context else "User"
        user_role = user_context.get("role", "customer") if user_context else "customer"
        user_wallet = user_context.get("walletBalance", 0.0) if user_context else 0.0

        if not self.client:
            q = message.lower()
            reply = f"Hello {user_name}! I can help you book deep cleaning, tap repairs, MCB updates, and AC service. How can I assist you today?"
            if "wallet" in q or "balance" in q:
                reply = f"Your current wallet balance is ₹{user_wallet}. You can use this to make instant service bookings."
            elif "booking" in q or "status" in q:
                reply = "You can view your active service bookings under the 'Bookings' tab in the bottom navigation panel."
            return {"reply": reply, "language": "en"}

        try:
            system_prompt = f"""
            You are ServaLocal Assistant, an AI expert customer service bot for ServaLocal (an Urban Company styled home services SaaS).
            - User Name: {user_name}
            - User Role: {user_role}
            - Wallet Balance: ₹{user_wallet}
            
            Guidelines:
            1. Keep responses clear, helpful, and concise (under 3 sentences where possible).
            2. Support English, Tamil, and Hindi. Respond in the language the user addresses you in.
            3. Answer questions about Deep Cleaning, Tap Repair, Modular Switch installation, and AC Jet Service.
            4. If they wish to book, direct them to select standard category cards or type queries like "I want to clean my room".
            """
            
            messages = [{"role": "system", "content": system_prompt}]
            # Append recent history
            for item in chat_history[-5:]:
                messages.append(item)
            messages.append({"role": "user", "content": message})

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.7
            )
            return {"reply": response.choices[0].message.content, "language": "en"}
        except Exception as e:
            logger.error(f"Error in AI Chat Assistant: {e}")
            return {"reply": "Sorry, my systems are currently under maintenance. How can I help you?", "language": "en"}

    def forecast_demand(self, zone_id: str, historical_bookings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyzes zone historical requests and yields booking demand predictions for the next 7 days.
        """
        if not self.client:
            # Local Heuristic Forecast
            return {
                "zoneId": zone_id,
                "forecast": [
                    {"day": "Monday", "predictedBookings": 12, "recommendedSurge": 1.0},
                    {"day": "Tuesday", "predictedBookings": 10, "recommendedSurge": 1.0},
                    {"day": "Wednesday", "predictedBookings": 11, "recommendedSurge": 1.0},
                    {"day": "Thursday", "predictedBookings": 15, "recommendedSurge": 1.1},
                    {"day": "Friday", "predictedBookings": 22, "recommendedSurge": 1.2},
                    {"day": "Saturday", "predictedBookings": 35, "recommendedSurge": 1.4},
                    {"day": "Sunday", "predictedBookings": 28, "recommendedSurge": 1.3}
                ]
            }

        try:
            prompt = f"""
            Analyze the following historical booking records for Zone {zone_id} and project daily booking demand and recommended surge multipliers (1.0x to 2.0x) for the next 7 days.
            
            Historical Bookings (Last 14 days summarized):
            {json.dumps(historical_bookings)}

            Return ONLY a valid JSON object matching this schema:
            {{
              "zoneId": "{zone_id}",
              "forecast": [
                {{ "day": "Monday", "predictedBookings": int, "recommendedSurge": float }},
                ...
              ]
            }}
            """
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Demand Forecasting failed: {e}")
            return {"zoneId": zone_id, "error": str(e)}

    def analyze_sentiment(self, text: str) -> str:
        """Classifies a customer review text into positive, neutral, or negative."""
        if not self.client:
            q = text.lower()
            if any(w in q for w in ["good", "great", "excellent", "awesome", "perfect", "on time", "nice", "5 stars"]):
                return "positive"
            if any(w in q for w in ["bad", "worst", "slow", "delay", "rude", "dirty", "unprofessional"]):
                return "negative"
            return "neutral"

        try:
            prompt = f"Analyze the sentiment of this review text: \"{text}\". Classify it as positive, neutral, or negative. Return ONLY the classification word."
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0
            )
            return response.choices[0].message.content.strip().lower()
        except Exception as e:
            logger.error(f"Sentiment Analysis failed: {e}")
            return "neutral"

ai_service = AIService()
