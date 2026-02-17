from django.contrib import admin
from django.urls import include, path

from apps.core.views import HealthCheckView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', HealthCheckView.as_view(), name='health-check'),
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/stores/', include('apps.stores.urls')),
    path('api/v1/walks/', include('apps.walks.urls')),
    path('api/v1/billing/', include('apps.billing.urls')),
    path('api/v1/kb/', include('apps.kb.urls')),
]
