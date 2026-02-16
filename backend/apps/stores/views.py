from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import IsOrgAdmin, IsOrgMember

from .models import Region, Store
from .serializers import RegionSerializer, StoreSerializer


class RegionViewSet(ModelViewSet):
    """CRUD operations for regions, scoped to the current organization."""
    serializer_class = RegionSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_queryset(self):
        return Region.objects.filter(organization=self.request.org)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)


class StoreViewSet(ModelViewSet):
    """CRUD operations for stores, scoped to the current organization."""
    serializer_class = StoreSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsOrgMember()]
        return [IsAuthenticated(), IsOrgAdmin()]

    def get_queryset(self):
        queryset = Store.objects.filter(organization=self.request.org).select_related('region')

        # Optional filters
        region = self.request.query_params.get('region')
        if region:
            queryset = queryset.filter(region_id=region)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)

        return queryset

    def perform_create(self, serializer):
        serializer.save(organization=self.request.org)
