;; EcoForge: Carbon Emissions Tracking Smart Contract
;; Enables individuals to securely log and analyze their carbon footprint

;; Error Codes
(define-constant ERR_UNAUTHORIZED u403)
(define-constant ERR_INVALID_EMISSION u400)
(define-constant ERR_PROFILE_NOT_FOUND u404)
(define-constant ERR_DUPLICATE_ENTRY u409)

;; Emission Categories
(define-constant CATEGORY_TRANSPORTATION u1)
(define-constant CATEGORY_ENERGY u2)
(define-constant CATEGORY_DIET u3)

;; Data Structures
;; User profile map with emission history
(define-map user-profiles 
  principal 
  {
    total-emissions: uint,
    emission-count: uint
  }
)

;; Emission log map to track historical data
(define-map emission-logs 
  { 
    user: principal, 
    timestamp: uint 
  }
  {
    category: uint,
    carbon-units: uint
  }
)

;; Track last emission timestamp to prevent duplicates
(define-map last-emission 
  principal 
  uint
)

;; Private Functions
;; Validate emission input
(define-private (validate-emission (carbon-units uint) (category uint))
  (and 
    (> carbon-units u0)  ;; Positive emission
    (< carbon-units u10000)  ;; Reasonable upper limit
    (or 
      (is-eq category CATEGORY_TRANSPORTATION)
      (is-eq category CATEGORY_ENERGY)
      (is-eq category CATEGORY_DIET)
    )
  )
)

;; Update user profile emissions
(define-private (update-user-profile (user principal) (carbon-units uint))
  (let 
    ((current-profile (unwrap! (map-get? user-profiles user) (err ERR_PROFILE_NOT_FOUND))))
    (map-set user-profiles user 
      {
        total-emissions: (+ (get total-emissions current-profile) carbon-units),
        emission-count: (+ (get emission-count current-profile) u1)
      }
    )
    (ok true)
  )
)

;; Public Functions
;; Create user profile
(define-public (create-profile)
  (begin
    (map-insert user-profiles tx-sender 
      {
        total-emissions: u0, 
        emission-count: u0
      }
    )
    (ok true)
  )
)

;; Log carbon emissions
(define-public (log-emission (carbon-units uint) (category uint))
  (let 
    ((current-timestamp block-height))
    
    ;; Validate profile exists
    (asserts! (is-some (map-get? user-profiles tx-sender)) (err ERR_PROFILE_NOT_FOUND))
    
    ;; Validate emission data
    (asserts! (validate-emission carbon-units category) (err ERR_INVALID_EMISSION))
    
    ;; Prevent duplicate entries in same block
    (asserts! 
      (not (is-eq 
        (default-to u0 (map-get? last-emission tx-sender)) 
        current-timestamp
      )) 
      (err ERR_DUPLICATE_ENTRY)
    )
    
    ;; Log emission
    (map-set emission-logs 
      { 
        user: tx-sender, 
        timestamp: current-timestamp 
      }
      {
        category: category,
        carbon-units: carbon-units
      }
    )
    
    ;; Update last emission timestamp
    (map-set last-emission tx-sender current-timestamp)
    
    ;; Update user profile
    (unwrap! (update-user-profile tx-sender carbon-units) (err ERR_PROFILE_NOT_FOUND))
    
    (ok true)
  )
)

;; Read-only Functions
;; Get user total emissions
(define-read-only (get-total-emissions (user principal))
  (let 
    ((profile (map-get? user-profiles user)))
    (if (is-some profile)
        (get total-emissions (unwrap-panic profile))
        u0
    )
  )
)

;; Get emission history
(define-read-only (get-emission-history (user principal))
  (begin
    ;; In a real implementation, this would return a list of emissions
    ;; This is a placeholder that returns the total emissions
    (ok (get-total-emissions user))
  )
)

;; Emissions by category (simplified)
(define-read-only (get-emissions-by-category (user principal) (category uint))
  (begin
    ;; In a full implementation, this would query and aggregate emissions by category
    (ok u0)
  )
)