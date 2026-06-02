from fastapi import HTTPException, status

class ServaLocalException(HTTPException):
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)

class WalletOverdraftException(ServaLocalException):
    def __init__(self, detail: str = "Insufficient wallet balance to perform this operation."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

class BookingStatusException(ServaLocalException):
    def __init__(self, detail: str = "This action is invalid for the booking's current state."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

class WorkerNotAvailableException(ServaLocalException):
    def __init__(self, detail: str = "No qualified worker is available for this zone or slot."):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class CouponInvalidException(ServaLocalException):
    def __init__(self, detail: str = "Coupon code is invalid, expired, or has reached its usage limit."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
